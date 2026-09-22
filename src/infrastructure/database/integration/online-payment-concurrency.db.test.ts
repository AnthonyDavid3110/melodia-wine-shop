import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  confirmOnlinePayment,
  initiateOnlinePayment,
} from "@/infrastructure/payments/online-payments";
import {
  campaignProducts,
  campaigns,
  orderEvents,
  orderItems,
  orders,
  paymentEvents,
  payments,
  products,
} from "../schema";
import { unique } from "./fixtures";
import { db } from "./setup";

/**
 * Real COMMITTED transactions on purpose (not `withRollback`) — proves
 * the `SELECT ... FOR UPDATE` row lock in
 * `applySuccessfulOnlinePayment()` (plus the `payment_events` unique
 * backstop) genuinely serializes two concurrent confirmations of the
 * SAME online payment attempt, exactly like
 * `settlement-concurrency.db.test.ts` proves the equivalent for
 * settlement creation. Every call here uses the default `dbHandle`
 * (real pooled `db`, a genuinely separate connection per call) — never
 * a single shared transaction handle, which cannot exercise true
 * concurrency (see the note in online-payments.db.test.ts).
 */

vi.mock("@/infrastructure/payments/saferpay-client", () => ({
  initializePaymentPage: vi.fn(),
  assertPaymentPage: vi.fn(),
}));

const { initializePaymentPage, assertPaymentPage } =
  await import("@/infrastructure/payments/saferpay-client");

async function getRealActiveCampaign() {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) {
    throw new Error(
      "This suite requires a seeded ACTIVE campaign (run `pnpm db:seed` if the local DB is empty).",
    );
  }
  return campaign;
}

async function addTemporaryProduct(campaignId: string, unitPriceAmount = 1_800) {
  const [product] = await db
    .insert(products)
    .values({ slug: unique("online-pay-wine"), name: unique("Online Pay Wine"), category: "WHITE" })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await db.insert(campaignProducts).values({ campaignId, productId: product.id, unitPriceAmount });
  return product;
}

function customerInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    customerEmail: "jean@example.test",
    customerPhone: "079 000 00 00",
    deliveryNote: "",
    items: [],
    sellerId: null,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];

afterEach(async () => {
  vi.mocked(initializePaymentPage).mockReset();
  vi.mocked(assertPaymentPage).mockReset();

  const orderIds = createdOrderIds.splice(0);
  if (orderIds.length > 0) {
    await db.delete(paymentEvents).where(
      inArray(
        paymentEvents.paymentId,
        (
          await db
            .select({ id: payments.id })
            .from(payments)
            .where(inArray(payments.orderId, orderIds))
        ).map((p) => p.id),
      ),
    );
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    await db.delete(payments).where(inArray(payments.orderId, orderIds));
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }

  const productIds = createdProductIds.splice(0);
  if (productIds.length > 0) {
    await db.delete(campaignProducts).where(inArray(campaignProducts.productId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
  }
});

describe("confirmOnlinePayment concurrency", () => {
  it("two concurrent confirmations of the SAME attempt: the success transition applies exactly once", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);

    const orderResult = await createOrder(
      customerInput({
        items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        paymentMethod: "TWINT",
      }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (orderResult.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(orderResult.order.id);

    vi.mocked(initializePaymentPage).mockResolvedValue({
      token: `saferpay-token-${randomUUID()}`,
      redirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/somepage",
      expiration: new Date(Date.now() + 15 * 60_000),
    });
    await initiateOnlinePayment(orderResult.order.id, "TWINT", "https://vins.ecmelodia.ch/retour");

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderResult.order.id));
    if (!payment?.returnToken) throw new Error("fixture attempt has no return token");

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "CAPTURED",
      transactionId: "txn-real-concurrency-1",
      amountValue: String(orderResult.order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    const attempt = () => confirmOnlinePayment(payment.returnToken!);
    const results = await Promise.allSettled([attempt(), attempt()]);

    // Both calls resolve successfully (confirmOnlinePayment never
    // throws for a normal race — the loser just observes the winner's
    // committed SUCCEEDED state) and agree on the outcome.
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") {
        expect(result.value.status).toBe("SUCCEEDED");
      }
    }

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderResult.order.id));
    expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);

    const pEvents = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, payment.id));
    expect(pEvents).toHaveLength(1);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderResult.order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
    expect(finalOrder?.customerPaymentStatus).toBe("PAID");
  });
});
