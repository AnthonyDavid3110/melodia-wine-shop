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
  capturePayment: vi.fn(),
}));

const { initializePaymentPage, assertPaymentPage, capturePayment } =
  await import("@/infrastructure/payments/saferpay-client");
const { GET: notifyRouteGET } = await import("@/app/api/payments/saferpay/notify/[token]/route");

function callNotifyRoute(token: string) {
  return notifyRouteGET(new Request("http://localhost/api/payments/saferpay/notify/" + token), {
    params: Promise.resolve({ token }),
  });
}

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
  vi.mocked(capturePayment).mockReset();

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
    await initiateOnlinePayment(orderResult.order.id, "TWINT");

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

  it("two concurrent confirmations of the SAME AUTHORIZED attempt cannot produce two effective captures or duplicate local success transitions (Gate 10C-A, mandatory)", async () => {
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
    await initiateOnlinePayment(orderResult.order.id, "TWINT");

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderResult.order.id));
    if (!payment?.returnToken) throw new Error("fixture attempt has no return token");

    // Both concurrent callers observe the SAME AUTHORIZED Assert result
    // — a real Saferpay Assert is a read-only query, safe to answer
    // identically to both.
    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "AUTHORIZED",
      transactionId: "txn-real-concurrency-authorized",
      amountValue: String(orderResult.order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    // Mirrors Saferpay's own documented Capture idempotency: the two
    // concurrent Transaction/Capture calls are serialized SERVER-SIDE —
    // one genuinely captures, the other observes
    // TRANSACTION_ALREADY_CAPTURED (never a fabricated local lock
    // simulating this — this is the actual provider-documented
    // behavior being exercised).
    vi.mocked(capturePayment)
      .mockResolvedValueOnce({ kind: "captured", captureId: "cap-winner" })
      .mockResolvedValueOnce({ kind: "already_captured" });

    const attempt = () => confirmOnlinePayment(payment.returnToken!);
    const results = await Promise.allSettled([attempt(), attempt()]);

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") {
        expect(result.value.status).toBe("SUCCEEDED");
      }
    }

    expect(vi.mocked(capturePayment)).toHaveBeenCalledTimes(2);

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderResult.order.id));
    expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);
    expect(events.filter((e) => e.type === "PAYMENT_ANOMALY_DETECTED")).toHaveLength(0);

    const pEvents = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, payment.id));
    expect(pEvents).toHaveLength(1);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderResult.order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
    expect(finalOrder?.customerPaymentStatus).toBe("PAID");

    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("SUCCEEDED");
    expect(finalPayment?.providerPaymentId).toBe("txn-real-concurrency-authorized");
  });

  it("browser Return and Saferpay Notify racing on the SAME AUTHORIZED attempt converge to exactly one success (Gate 10C-B1, mandatory)", async () => {
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
    await initiateOnlinePayment(orderResult.order.id, "TWINT");

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderResult.order.id));
    if (!payment?.returnToken) throw new Error("fixture attempt has no return token");

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "AUTHORIZED",
      transactionId: "txn-return-notify-race",
      amountValue: String(orderResult.order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });
    // Mirrors Saferpay's own documented Capture idempotency, same as
    // the concurrent-Notify test above — one caller genuinely captures,
    // the other observes TRANSACTION_ALREADY_CAPTURED.
    vi.mocked(capturePayment)
      .mockResolvedValueOnce({ kind: "captured", captureId: "cap-race-winner" })
      .mockResolvedValueOnce({ kind: "already_captured" });

    // Caller 1: the browser Return path (calls confirmOnlinePayment
    // directly, exactly like /commande/retour does). Caller 2: the
    // Saferpay Notify path (the real notify route handler). Both race
    // on the SAME Payment/returnToken, using genuinely separate
    // connections (no shared transaction handle).
    const [returnResult, notifyResponse] = await Promise.all([
      confirmOnlinePayment(payment.returnToken!),
      callNotifyRoute(payment.returnToken!),
    ]);

    expect(returnResult.status).toBe("SUCCEEDED");
    expect(notifyResponse.status).toBe(200);

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderResult.order.id));
    expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);
    expect(events.filter((e) => e.type === "PAYMENT_ANOMALY_DETECTED")).toHaveLength(0);

    const pEvents = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, payment.id));
    expect(pEvents).toHaveLength(1);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderResult.order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
    expect(finalOrder?.customerPaymentStatus).toBe("PAID");

    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("SUCCEEDED");
  });
});
