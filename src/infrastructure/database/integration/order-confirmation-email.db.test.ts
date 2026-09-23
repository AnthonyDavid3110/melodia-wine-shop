import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
 * Phase 11 Gate 11B — automatic order-confirmation email dispatch.
 *
 * Real COMMITTED transactions on purpose (not `withRollback`), exactly
 * like `create-order-concurrency.db.test.ts`/
 * `online-payment-concurrency.db.test.ts` — dispatch eligibility is
 * deliberately gated on `dbHandle === db` (see the guards in
 * create-order.ts/online-payments.ts), so a `withRollback` savepoint
 * handle would never exercise it at all.
 */

vi.mock("@/infrastructure/payments/saferpay-client", () => ({
  initializePaymentPage: vi.fn(),
  assertPaymentPage: vi.fn(),
  capturePayment: vi.fn(),
}));
// `importOriginal` preserves the real EmailConfigurationError/
// EmailProviderRejectedError/EmailNetworkError classes — order-
// confirmation.ts's classifyEmailFailure() does `instanceof` checks
// against them, which would break (undefined is not a constructor) if
// this mock only exported `sendEmail`.
vi.mock("@/infrastructure/email/resend-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/email/resend-provider")>();
  return { ...actual, sendEmail: vi.fn() };
});

const { initializePaymentPage, assertPaymentPage } =
  await import("@/infrastructure/payments/saferpay-client");
const { sendEmail: mockedSendEmail, EmailProviderRejectedError } =
  await import("@/infrastructure/email/resend-provider");

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
    .values({ slug: unique("email-wine"), name: unique("Email Wine"), category: "WHITE" })
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

beforeEach(() => {
  vi.mocked(mockedSendEmail).mockReset();
  vi.mocked(initializePaymentPage).mockReset();
  vi.mocked(assertPaymentPage).mockReset();
});

afterEach(async () => {
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

async function emailEventsFor(orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(
      and(
        inArray(orderEvents.type, ["EMAIL_SENT", "EMAIL_FAILED"]),
        eq(orderEvents.orderId, orderId),
      ),
    );
}

describe("SELLER-payment order — automatic dispatch", () => {
  it("a newly created public checkout SELLER order gets exactly one EMAIL_SENT with the SELLER_PAYMENT variant", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-seller-1" });
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);

    const result = await createOrder(
      customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (result.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(result.order.id);

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [sendCall] = vi.mocked(mockedSendEmail).mock.calls;
    expect(sendCall?.[0]).toMatchObject({ to: "jean@example.test" });
    expect(sendCall?.[0]?.idempotencyKey).toBe(`order-confirmation/${result.order.id}`);

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, result.order.id));
    const emailEvents = events.filter((e) => e.type === "EMAIL_SENT" || e.type === "EMAIL_FAILED");
    expect(emailEvents).toHaveLength(1);
    expect(emailEvents[0]?.type).toBe("EMAIL_SENT");
    expect(emailEvents[0]?.metadata).toMatchObject({
      emailType: "ORDER_CONFIRMATION",
      variant: "SELLER_PAYMENT",
    });
  });

  it("an idempotent checkout replay ('existing') does NOT trigger a second dispatch", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-seller-2" });
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const key = randomUUID();

    const first = await createOrder(
      customerInput({
        items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        idempotencyKey: key,
      }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (first.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(first.order.id);

    const second = await createOrder(
      customerInput({
        items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        idempotencyKey: key,
      }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    expect(second.status).toBe("existing");

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });

  it("a MANUAL admin-entered order does NOT trigger automatic dispatch", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-manual" });
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);

    const result = await createOrder(
      customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
      { type: "SYSTEM" },
      "MANUAL",
    );
    if (result.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(result.order.id);

    expect(mockedSendEmail).not.toHaveBeenCalled();
    const events = await emailEventsFor(result.order.id);
    expect(events).toHaveLength(0);
  });

  it("email failure after commit does not remove/cancel/change the created order, and records EMAIL_FAILED", async () => {
    vi.mocked(mockedSendEmail).mockRejectedValue(
      new EmailProviderRejectedError("Invalid `to` field.", "validation_error"),
    );
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);

    const result = await createOrder(
      customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (result.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(result.order.id);

    // The order itself is untouched by the email failure.
    const [orderRow] = await db.select().from(orders).where(eq(orders.id, result.order.id));
    expect(orderRow?.status).toBe("CONFIRMED");
    expect(orderRow?.customerPaymentStatus).toBe("PENDING");

    const events = await emailEventsFor(result.order.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("EMAIL_FAILED");
    expect(events[0]?.metadata).toMatchObject({
      emailType: "ORDER_CONFIRMATION",
      variant: "SELLER_PAYMENT",
      category: "provider-rejected",
    });
    // The provider's raw message must never be persisted.
    expect(JSON.stringify(events[0]?.metadata)).not.toContain("Invalid `to` field");
  });
});

describe("ONLINE-payment order — automatic dispatch", () => {
  async function createOnlineOrderAndConfirm(overrides: { transactionId: string }) {
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
      transactionId: overrides.transactionId,
      amountValue: String(orderResult.order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    return { order: orderResult.order, returnToken: payment.returnToken };
  }

  it("the first authoritative successful payment transition gets exactly one EMAIL_SENT with the ONLINE_PAID variant", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-online-1" });
    const { order, returnToken } = await createOnlineOrderAndConfirm({
      transactionId: `txn-email-${randomUUID()}`,
    });

    const result = await confirmOnlinePayment(returnToken);
    expect(result.status).toBe("SUCCEEDED");

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [sendCall] = vi.mocked(mockedSendEmail).mock.calls;
    expect(sendCall?.[0]?.idempotencyKey).toBe(`order-confirmation/${order.id}`);

    const events = await emailEventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("EMAIL_SENT");
    expect(events[0]?.metadata).toMatchObject({
      emailType: "ORDER_CONFIRMATION",
      variant: "ONLINE_PAID",
    });
  });

  it("a subsequent idempotent confirmOnlinePayment call (already SUCCEEDED) does NOT dispatch again", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-online-2" });
    const { returnToken } = await createOnlineOrderAndConfirm({
      transactionId: `txn-email-${randomUUID()}`,
    });

    const first = await confirmOnlinePayment(returnToken);
    expect(first.status).toBe("SUCCEEDED");
    const second = await confirmOnlinePayment(returnToken);
    expect(second.status).toBe("SUCCEEDED");

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });

  it("two concurrent confirmOnlinePayment calls for the SAME attempt (Return/Notify race) produce exactly one dispatch", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "msg-online-3" });
    const { order, returnToken } = await createOnlineOrderAndConfirm({
      transactionId: `txn-email-${randomUUID()}`,
    });

    const [resultA, resultB] = await Promise.all([
      confirmOnlinePayment(returnToken),
      confirmOnlinePayment(returnToken),
    ]);
    expect([resultA.status, resultB.status]).toEqual(["SUCCEEDED", "SUCCEEDED"]);

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const events = await emailEventsFor(order.id);
    expect(events).toHaveLength(1);
  });

  it("email failure does not affect the already-successful payment/order state, and records EMAIL_FAILED", async () => {
    vi.mocked(mockedSendEmail).mockRejectedValue(new Error("boom"));
    const { order, returnToken } = await createOnlineOrderAndConfirm({
      transactionId: `txn-email-${randomUUID()}`,
    });

    const result = await confirmOnlinePayment(returnToken);
    expect(result.status).toBe("SUCCEEDED");

    const [orderRow] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(orderRow?.status).toBe("CONFIRMED");
    expect(orderRow?.customerPaymentStatus).toBe("PAID");

    const events = await emailEventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("EMAIL_FAILED");
    expect(events[0]?.metadata).toMatchObject({
      emailType: "ORDER_CONFIRMATION",
      variant: "ONLINE_PAID",
      category: "unknown",
    });
  });
});
