import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  OnlinePaymentNotEligibleError,
  PaymentAttemptNotFoundError,
  confirmOnlinePayment,
  initiateOnlinePayment,
} from "@/infrastructure/payments/online-payments";
import { canPrepareOrder } from "@/domain/orders/order-guards";
import {
  campaignProducts,
  campaigns,
  orderEvents,
  orders,
  paymentEvents,
  payments,
  products,
} from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

vi.mock("@/infrastructure/payments/saferpay-client", () => ({
  initializePaymentPage: vi.fn(),
  assertPaymentPage: vi.fn(),
}));

const { initializePaymentPage, assertPaymentPage } =
  await import("@/infrastructure/payments/saferpay-client");

beforeEach(() => {
  vi.mocked(initializePaymentPage).mockReset();
  vi.mocked(assertPaymentPage).mockReset();
});

function mockInitializeSuccess() {
  vi.mocked(initializePaymentPage).mockResolvedValue({
    token: `saferpay-token-${randomUUID()}`,
    redirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/somepage",
    expiration: new Date(Date.now() + 15 * 60_000),
  });
}

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupActiveCampaign(tx: Tx) {
  await neutralizeExistingActiveCampaigns(tx);
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  return campaign;
}

async function setupProduct(tx: Tx, campaignId: string, unitPriceAmount = 1_800) {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique("wine"), name: unique("Wine"), category: "WHITE", active: true })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await tx
    .insert(campaignProducts)
    .values({ campaignId, productId: product.id, unitPriceAmount, active: true });
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

async function createOnlineOrder(
  tx: Tx,
  campaignId: string,
  productId: string,
  method: "TWINT" | "CARD" = "TWINT",
) {
  const result = await createOrder(
    customerInput({
      items: [{ type: "PRODUCT", id: productId, quantity: 1 }],
      paymentMethod: method,
    }),
    { type: "SYSTEM" },
    "ONLINE",
    tx,
  );
  if (result.status !== "created")
    throw new Error(`fixture order creation failed: ${JSON.stringify(result)}`);
  return result.order;
}

async function createOfflineOrder(tx: Tx, campaignId: string, productId: string) {
  const result = await createOrder(
    customerInput({ items: [{ type: "PRODUCT", id: productId, quantity: 1 }] }),
    { type: "SYSTEM" },
    "ONLINE",
    tx,
  );
  if (result.status !== "created")
    throw new Error(`fixture order creation failed: ${JSON.stringify(result)}`);
  return result.order;
}

describe("createOrder — online payment method", () => {
  it("starts an online order NEW / PENDING / NOT_APPLICABLE, with no Payment row", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id);

      expect(order.status).toBe("NEW");
      expect(order.customerPaymentStatus).toBe("PENDING");
      expect(order.sellerSettlementStatus).toBe("NOT_APPLICABLE");
      expect(order.confirmedAt).toBeNull();

      const rows = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(rows).toHaveLength(0);
    });
  });

  it("leaves the offline SELLER path completely unchanged", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOfflineOrder(tx, campaign.id, product.id);

      expect(order.status).toBe("CONFIRMED");
      expect(order.customerPaymentStatus).toBe("PENDING");
      expect(order.sellerSettlementStatus).toBe("PENDING");
      expect(order.confirmedAt).not.toBeNull();

      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(payment).toMatchObject({ method: "SELLER", provider: "OFFLINE", status: "PENDING" });
    });
  });
});

describe("initiateOnlinePayment", () => {
  it("creates a PENDING Payment attempt with a return token and provider session id", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();

      const result = await initiateOnlinePayment(
        order.id,
        "TWINT",
        "https://vins.ecmelodia.ch/retour",
        tx,
      );
      expect(result.redirectUrl).toContain("saferpay.com");

      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(payment).toMatchObject({ method: "TWINT", provider: "SAFERPAY", status: "PENDING" });
      expect(payment!.returnToken).toBeTruthy();
      expect(payment!.providerSessionId).toBeTruthy();
      expect(payment!.amount).toBe(order.totalAmount);
    });
  });

  it("rejects initiation for an order that is not NEW/PENDING", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOfflineOrder(tx, campaign.id, product.id);

      await expect(
        initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx),
      ).rejects.toThrow(OnlinePaymentNotEligibleError);
    });
  });

  it("supersedes (CANCELLED) a prior active attempt before creating a fresh one — no duplicate active attempts", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();

      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      await initiateOnlinePayment(order.id, "CARD", "https://vins.ecmelodia.ch/retour", tx);

      const rows = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(rows).toHaveLength(2);
      const statuses = rows.map((r) => r.status).sort();
      expect(statuses).toEqual(["CANCELLED", "PENDING"]);
    });
  });

  it("marks the local attempt FAILED if the Saferpay Initialize call itself fails — no phantom PENDING attempt", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      vi.mocked(initializePaymentPage).mockRejectedValue(new Error("network down"));

      await expect(
        initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx),
      ).rejects.toThrow("network down");

      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(payment!.status).toBe("FAILED");
    });
  });

  it("a fresh attempt after FAILED and after CANCELLED both create genuinely new Payment rows", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");

      vi.mocked(initializePaymentPage).mockRejectedValueOnce(new Error("boom"));
      await expect(
        initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx),
      ).rejects.toThrow();

      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "CARD", "https://vins.ecmelodia.ch/retour", tx);

      const rows = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.status === "FAILED")).toBeTruthy();
      expect(rows.find((r) => r.status === "PENDING")).toBeTruthy();
    });
  });
});

describe("confirmOnlinePayment — authoritative success", () => {
  it("applies the full atomic success transition", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-abc-123",
        amountValue: String(order.totalAmount),
        currencyCode: "CHF",
        paymentMethod: "TWINT",
      });

      const before = new Date();
      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("SUCCEEDED");

      const [updatedPayment] = await tx.select().from(payments).where(eq(payments.id, payment!.id));
      expect(updatedPayment!.status).toBe("SUCCEEDED");
      expect(updatedPayment!.paidAt).not.toBeNull();
      expect(updatedPayment!.paidAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(updatedPayment!.providerPaymentId).toBe("txn-abc-123");

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder!.customerPaymentStatus).toBe("PAID");
      expect(updatedOrder!.status).toBe("CONFIRMED");
      expect(updatedOrder!.confirmedAt).not.toBeNull();
      expect(updatedOrder!.sellerSettlementStatus).toBe("NOT_APPLICABLE");

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const providerEvent = events.find((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER");
      expect(providerEvent).toMatchObject({ actorType: "PAYMENT_PROVIDER" });

      const pEvents = await tx
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.paymentId, payment!.id));
      expect(pEvents).toHaveLength(1);
      expect(pEvents[0]).toMatchObject({ provider: "SAFERPAY", providerEventId: "txn-abc-123" });
    });
  });

  it("is idempotent under repeated processing — no duplicate OrderEvent/PaymentEvent, fulfilment guard confirms eligibility unlocked exactly once", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-repeat-1",
        amountValue: String(order.totalAmount),
        currencyCode: "CHF",
        paymentMethod: "TWINT",
      });

      await confirmOnlinePayment(payment!.returnToken!, tx);
      const secondResult = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(secondResult.status).toBe("SUCCEEDED");

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);

      const pEvents = await tx
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.paymentId, payment!.id));
      expect(pEvents).toHaveLength(1);
    });
  });

  // True cross-connection concurrency (two genuinely separate database
  // connections racing to confirm the same attempt) is covered
  // separately in online-payment-concurrency.db.test.ts, using real
  // committed transactions — a single shared `withRollback` transaction
  // cannot exercise it (issuing two un-awaited nested `tx.transaction()`
  // calls against the SAME connection/transaction from two overlapping
  // async call stacks is invalid driver usage, not a scenario a real
  // caller can produce — the same limitation documented for
  // create-order-concurrency.db.test.ts / settlement-concurrency.db.test.ts).

  it("rejects an amount mismatch — never applies PAID, surfaces an anomaly event instead", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-wrong-amount",
        amountValue: String(order.totalAmount + 100),
        currencyCode: "CHF",
        paymentMethod: "TWINT",
      });

      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("PROCESSING");
      expect(result.anomaly).toBe(true);

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder!.customerPaymentStatus).toBe("PENDING");
      expect(updatedOrder!.status).toBe("NEW");

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.some((e) => e.type === "PAYMENT_ANOMALY_DETECTED")).toBe(true);
    });
  });

  it("rejects a currency mismatch the same way", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-wrong-currency",
        amountValue: String(order.totalAmount),
        currencyCode: "EUR",
        paymentMethod: "TWINT",
      });

      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("PROCESSING");
      expect(result.anomaly).toBe(true);

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder!.customerPaymentStatus).toBe("PENDING");
    });
  });

  it("treats a second attempt's success as an anomaly when another attempt already paid the order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [firstPayment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-first",
        amountValue: String(order.totalAmount),
        currencyCode: "CHF",
        paymentMethod: "TWINT",
      });
      await confirmOnlinePayment(firstPayment!.returnToken!, tx);

      // Manually fabricate a second SUCCEEDED-eligible attempt row to
      // simulate the (already-guarded-against) duplicate-success case.
      const [secondPayment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          method: "CARD",
          provider: "SAFERPAY",
          amount: order.totalAmount,
          currency: "CHF",
          status: "PENDING",
          returnToken: randomUUID(),
          providerSessionId: "fake-session",
        })
        .returning();

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "success",
        providerStatus: "CAPTURED",
        transactionId: "txn-second",
        amountValue: String(order.totalAmount),
        currencyCode: "CHF",
        paymentMethod: "CARD",
      });
      const result = await confirmOnlinePayment(secondPayment!.returnToken!, tx);
      expect(result.status).toBe("PROCESSING");

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.some((e) => e.type === "PAYMENT_ANOMALY_DETECTED")).toBe(true);
      expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);
    });
  });
});

describe("confirmOnlinePayment — failure / cancellation / processing", () => {
  it("FAILED does not confirm the order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "CARD");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "CARD", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({
        kind: "declined",
        errorName: "TRANSACTION_DECLINED",
        message: "declined",
      });

      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("FAILED");

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder!.status).toBe("NEW");
      expect(updatedOrder!.customerPaymentStatus).toBe("PENDING");
    });
  });

  it("CANCELLED (payer aborted) does not confirm the order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({ kind: "aborted" });

      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("CANCELLED");

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder!.status).toBe("NEW");
      expect(updatedOrder!.customerPaymentStatus).toBe("PENDING");
    });
  });

  it("PENDING/PROCESSING never confirms the order and never falsely fails it", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      mockInitializeSuccess();
      await initiateOnlinePayment(order.id, "TWINT", "https://vins.ecmelodia.ch/retour", tx);
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      vi.mocked(assertPaymentPage).mockResolvedValue({ kind: "pending" });

      const result = await confirmOnlinePayment(payment!.returnToken!, tx);
      expect(result.status).toBe("PROCESSING");

      const [updatedPayment] = await tx.select().from(payments).where(eq(payments.id, payment!.id));
      expect(updatedPayment!.status).toBe("PENDING");
    });
  });

  it("an unknown token throws a clean, typed error", async () => {
    await withRollback(async (tx) => {
      await expect(confirmOnlinePayment(randomUUID(), tx)).rejects.toThrow(
        PaymentAttemptNotFoundError,
      );
    });
  });
});

describe("Phase 9 fulfilment guards continue to reject NEW", () => {
  it("a NEW online order cannot be prepared", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const order = await createOnlineOrder(tx, campaign.id, product.id, "TWINT");
      expect(canPrepareOrder(order)).toBe(false);
    });
  });
});
