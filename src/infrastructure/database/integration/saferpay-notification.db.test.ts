import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  MultipleUnresolvedPaymentAttemptsError,
  NoReconcilablePaymentAttemptError,
  initiateOnlinePayment,
  reconcileOnlinePaymentForOrder,
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
 * DB-level proof that the real notify ROUTE HANDLER (Gate 10C-B1) —
 * not a re-implementation, the actual exported `GET` — reconciles
 * through the exact same trusted `confirmOnlinePayment()` path as the
 * browser return route, against a real database. Uses real committed
 * connections (the route always operates against the default `db`,
 * never a `withRollback` transaction handle) with manual cleanup,
 * mirroring `online-payment-concurrency.db.test.ts`.
 */

vi.mock("@/infrastructure/payments/saferpay-client", () => ({
  initializePaymentPage: vi.fn(),
  assertPaymentPage: vi.fn(),
  capturePayment: vi.fn(),
}));

const { initializePaymentPage, assertPaymentPage, capturePayment } =
  await import("@/infrastructure/payments/saferpay-client");
const { GET } = await import("@/app/api/payments/saferpay/notify/[token]/route");

async function callNotifyRoute(token: string) {
  return GET(new Request("http://localhost/api/payments/saferpay/notify/" + token), {
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
    .values({ slug: unique("notify-wine"), name: unique("Notify Wine"), category: "WHITE" })
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

async function createOnlineOrderWithAttempt(productId: string, method: "TWINT" | "CARD" = "TWINT") {
  const orderResult = await createOrder(
    customerInput({
      items: [{ type: "PRODUCT", id: productId, quantity: 1 }],
      paymentMethod: method,
    }),
    { type: "SYSTEM" },
    "ONLINE",
  );
  if (orderResult.status !== "created") throw new Error("fixture order creation failed");

  vi.mocked(initializePaymentPage).mockResolvedValue({
    token: `saferpay-token-${randomUUID()}`,
    redirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/somepage",
    expiration: new Date(Date.now() + 15 * 60_000),
  });
  await initiateOnlinePayment(orderResult.order.id, method);

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderResult.order.id));
  if (!payment?.returnToken) throw new Error("fixture attempt has no return token");

  return { order: orderResult.order, payment };
}

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];

afterEach(async () => {
  vi.mocked(initializePaymentPage).mockReset();
  vi.mocked(assertPaymentPage).mockReset();
  vi.mocked(capturePayment).mockReset();

  const orderIds = createdOrderIds.splice(0);
  if (orderIds.length > 0) {
    const orderPayments = await db
      .select({ id: payments.id })
      .from(payments)
      .where(inArray(payments.orderId, orderIds));
    const paymentIds = orderPayments.map((p) => p.id);
    if (paymentIds.length > 0) {
      await db.delete(paymentEvents).where(inArray(paymentEvents.paymentId, paymentIds));
    }
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

describe("GET /api/payments/saferpay/notify/[token] — DB integration", () => {
  it("A. Assert CAPTURED — notify reconciles to final local success", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "CAPTURED",
      transactionId: "txn-notify-captured",
      amountValue: String(order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    const response = await callNotifyRoute(payment.returnToken!);
    expect(response.status).toBe(200);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
    expect(finalOrder?.customerPaymentStatus).toBe("PAID");
    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("SUCCEEDED");
  });

  it("B. Assert AUTHORIZED then Capture — notify reconciles to final local success, never visiting /commande/retour", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "AUTHORIZED",
      transactionId: "txn-notify-authorized",
      amountValue: String(order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });
    vi.mocked(capturePayment).mockResolvedValue({ kind: "captured", captureId: "cap-notify-1" });

    const response = await callNotifyRoute(payment.returnToken!);
    expect(response.status).toBe(200);
    expect(capturePayment).toHaveBeenCalledWith("txn-notify-authorized");

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
    expect(finalOrder?.customerPaymentStatus).toBe("PAID");
  });

  it("C. cancellation via notify — Payment CANCELLED, Order stays NEW/PENDING", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({ kind: "aborted" });

    const response = await callNotifyRoute(payment.returnToken!);
    expect(response.status).toBe(200);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("NEW");
    expect(finalOrder?.customerPaymentStatus).toBe("PENDING");
    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("CANCELLED");
  });

  it("D. decline via notify — Payment FAILED, Order stays NEW/PENDING", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id, "CARD");
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "declined",
      errorName: "TRANSACTION_DECLINED",
      message: "declined",
    });

    const response = await callNotifyRoute(payment.returnToken!);
    expect(response.status).toBe(200);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("NEW");
    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("FAILED");
  });

  it("E. transient provider uncertainty via notify — no false terminal state, 503 (retryable)", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockRejectedValue(new Error("ECONNRESET"));

    const response = await callNotifyRoute(payment.returnToken!);
    expect(response.status).toBe(503);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("NEW");
    const [finalPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(finalPayment?.status).toBe("PENDING");
  });

  it("F. duplicate notify callback — no duplicate financial transition", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order, payment } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "CAPTURED",
      transactionId: "txn-notify-duplicate",
      amountValue: String(order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    const first = await callNotifyRoute(payment.returnToken!);
    const second = await callNotifyRoute(payment.returnToken!);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
    expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);
    const pEvents = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, payment.id));
    expect(pEvents).toHaveLength(1);
  });
});

describe("reconcileOnlinePaymentForOrder — admin manual reconciliation (Gate 10C-B1)", () => {
  it("reconciles the single eligible SAFERPAY attempt", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    vi.mocked(assertPaymentPage).mockResolvedValue({
      kind: "success",
      providerStatus: "CAPTURED",
      transactionId: "txn-admin-reconcile",
      amountValue: String(order.totalAmount),
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });

    const result = await reconcileOnlinePaymentForOrder(order.id);
    expect(result.status).toBe("SUCCEEDED");

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(finalOrder?.status).toBe("CONFIRMED");
  });

  it("throws NoReconcilablePaymentAttemptError when there is nothing to reconcile", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const orderResult = await createOrder(
      customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (orderResult.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(orderResult.order.id);

    // Offline SELLER order — no SAFERPAY attempt exists at all.
    await expect(reconcileOnlinePaymentForOrder(orderResult.order.id)).rejects.toThrow(
      NoReconcilablePaymentAttemptError,
    );
  });

  it("throws MultipleUnresolvedPaymentAttemptsError when more than one attempt is unexpectedly active", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const { order } = await createOnlineOrderWithAttempt(product.id);
    createdOrderIds.push(order.id);

    // Manually fabricate a second simultaneously-active attempt — a
    // situation `initiateOnlinePayment()`'s own supersede/refuse logic
    // should prevent in practice, but `reconcileOnlinePaymentForOrder`
    // must still fail safely rather than guess (Gate 10C-B1 §23).
    await db.insert(payments).values({
      orderId: order.id,
      method: "CARD",
      provider: "SAFERPAY",
      amount: order.totalAmount,
      currency: "CHF",
      status: "PENDING",
      returnToken: randomUUID(),
      providerSessionId: "fake-session-2",
    });

    await expect(reconcileOnlinePaymentForOrder(order.id)).rejects.toThrow(
      MultipleUnresolvedPaymentAttemptsError,
    );
  });
});
