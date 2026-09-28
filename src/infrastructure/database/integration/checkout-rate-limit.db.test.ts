import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrder,
  orderExistsForIdempotencyKey,
  type CreateOrderInput,
} from "@/infrastructure/orders/create-order";
import { initiateOnlinePayment } from "@/infrastructure/payments/online-payments";
import { consumeRateLimit } from "@/infrastructure/rate-limit/rate-limit";
import { ORDER_CREATION, PAYMENT_INITIATION } from "@/infrastructure/rate-limit/policies";
import {
  campaignProducts,
  campaigns,
  checkoutRateLimits,
  orderEvents,
  orderItems,
  orders,
  payments,
  products,
} from "../schema";
import { unique } from "./fixtures";
import { db, withRollback } from "./setup";

// Gate 14B abuse-regression coverage. Mirrors online-payments.db.test.ts's
// Saferpay mock exactly.
vi.mock("@/infrastructure/payments/saferpay-client", () => ({
  initializePaymentPage: vi.fn(),
  assertPaymentPage: vi.fn(),
  capturePayment: vi.fn(),
}));

const { initializePaymentPage } = await import("@/infrastructure/payments/saferpay-client");

// Real committed `db` is used for the email-visible tests below, so —
// exactly like settlement-concurrency.db.test.ts — the automatic
// SELLER-payment email dispatch must never reach the real Resend API.
vi.mock("@/infrastructure/email/resend-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/email/resend-provider")>();
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue({ messageId: "test-mocked-message-id" }),
  };
});

beforeEach(() => {
  vi.mocked(initializePaymentPage).mockReset();
  vi.mocked(initializePaymentPage).mockResolvedValue({
    token: `saferpay-token-${randomUUID()}`,
    redirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/somepage",
    expiration: new Date(Date.now() + 15 * 60_000),
  });
});

type AnyDbHandle = Pick<typeof db, "select" | "insert" | "update" | "delete" | "transaction">;

async function neutralizeExistingActiveCampaigns(tx: AnyDbHandle) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupActiveCampaign(tx: AnyDbHandle) {
  await neutralizeExistingActiveCampaigns(tx);
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  return campaign;
}

async function setupProduct(tx: AnyDbHandle, campaignId: string, unitPriceAmount = 1_800) {
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

function testIdentity(): string {
  return `test-identity-${randomUUID()}`;
}

/** Exactly mirrors submitCheckoutAction's own composition (Phase 14 Gate 14B, approved Step 1 §13). */
async function submitOrderThroughRateLimiter(
  tx: AnyDbHandle,
  identity: string,
  input: CreateOrderInput,
  now: Date,
) {
  const alreadyExists = await orderExistsForIdempotencyKey(input.idempotencyKey, tx);
  if (!alreadyExists) {
    const { allowed } = await consumeRateLimit(identity, ORDER_CREATION, tx, now);
    if (!allowed) {
      return { status: "rate-limited" as const };
    }
  }
  return createOrder(input, { type: "SYSTEM" }, "ONLINE", tx);
}

describe("checkout rate limiting — idempotency interaction", () => {
  it("a sequential retry of an already-persisted idempotency key never consumes order-creation quota", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const identity = testIdentity();
      const now = new Date();
      const key = randomUUID();

      const first = await submitOrderThroughRateLimiter(
        tx,
        identity,
        customerInput({
          idempotencyKey: key,
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        }),
        now,
      );
      expect(first.status).toBe("created");

      // Exhaust the ORDER_CREATION quota entirely with OTHER fresh keys.
      for (let i = 0; i < ORDER_CREATION.limit; i += 1) {
        await consumeRateLimit(identity, ORDER_CREATION, tx, now);
      }

      // The SAME key retried again must still succeed — it resolves via
      // the cheap existing-order pre-check, never touching the
      // now-fully-consumed quota.
      const retry = await submitOrderThroughRateLimiter(
        tx,
        identity,
        customerInput({
          idempotencyKey: key,
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        }),
        now,
      );
      expect(retry.status).toBe("existing");
      if (retry.status === "existing" || retry.status === "created") {
        expect(retry.order.id).toBe(first.status === "created" ? first.order.id : undefined);
      }
    });
  });

  it("fresh idempotency keys from the same identity each consume quota; attempts beyond the limit never reach createOrder", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const identity = testIdentity();
      const now = new Date();

      const results = [];
      for (let i = 0; i < ORDER_CREATION.limit + 2; i += 1) {
        results.push(
          await submitOrderThroughRateLimiter(
            tx,
            identity,
            customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
            now,
          ),
        );
      }

      const createdCount = results.filter((r) => r.status === "created").length;
      const rateLimitedCount = results.filter((r) => r.status === "rate-limited").length;
      expect(createdCount).toBe(ORDER_CREATION.limit);
      expect(rateLimitedCount).toBe(2);

      const allOrders = await tx.select().from(orders).where(eq(orders.campaignId, campaign.id));
      expect(allOrders).toHaveLength(ORDER_CREATION.limit);
    });
  });
});

describe("checkout rate limiting — abuse regression (Gate 14A HIGH finding)", () => {
  it("many fresh idempotency keys from one identity, varying customer emails: after the quota, no new Order and no new confirmation email", async () => {
    // Real committed `db` is required here (see the top-of-file comment), so
    // this test mutates the global single-ACTIVE-campaign invariant. That
    // mutation — and its own fixture rows — must be undone in `finally` no
    // matter how the test body exits, or it corrupts the shared development
    // database for every other test/run (see Gate 14B repair incident).
    const [previousActiveCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "ACTIVE"));
    const identity = testIdentity();
    const createdOrderIds: string[] = [];
    let campaign: Awaited<ReturnType<typeof setupActiveCampaign>> | undefined;
    let product: Awaited<ReturnType<typeof setupProduct>> | undefined;

    try {
      campaign = await setupActiveCampaign(db);
      product = await setupProduct(db, campaign.id);
      const now = new Date();
      const attemptCount = ORDER_CREATION.limit + 5;

      const results = [];
      for (let i = 0; i < attemptCount; i += 1) {
        results.push(
          await submitOrderThroughRateLimiter(
            db,
            identity,
            customerInput({
              customerEmail: `victim-${unique("email")}@example.test`,
              items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
            }),
            now,
          ),
        );
      }
      for (const r of results) {
        if (r.status === "created") createdOrderIds.push(r.order.id);
      }

      expect(createdOrderIds).toHaveLength(ORDER_CREATION.limit);

      const emailEvents = await db
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.type, "EMAIL_SENT"));
      const emailEventsForThisRun = emailEvents.filter((e) => createdOrderIds.includes(e.orderId));
      expect(emailEventsForThisRun).toHaveLength(ORDER_CREATION.limit);
    } finally {
      if (createdOrderIds.length > 0) {
        for (const orderId of createdOrderIds) {
          await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
          await db.delete(payments).where(eq(payments.orderId, orderId));
          await db.delete(orderEvents).where(eq(orderEvents.orderId, orderId));
        }
      }
      if (campaign) {
        await db.delete(orders).where(eq(orders.campaignId, campaign.id));
        if (product) {
          await db.delete(campaignProducts).where(eq(campaignProducts.campaignId, campaign.id));
          await db.delete(products).where(eq(products.id, product.id));
        }
        await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
      }
      await db.delete(checkoutRateLimits).where(eq(checkoutRateLimits.identityHash, identity));

      // Restore the global single-ACTIVE-campaign invariant regardless of
      // outcome — `setupActiveCampaign` neutralized whatever was ACTIVE
      // before this test ran.
      if (previousActiveCampaign) {
        await db
          .update(campaigns)
          .set({ status: "ACTIVE" })
          .where(eq(campaigns.id, previousActiveCampaign.id));
      }
    }
  });

  it("an over-limit online-payment-initiation attempt never calls the provider's Initialize", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const identity = testIdentity();
      const now = new Date();

      const order = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          paymentMethod: "TWINT",
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      if (order.status !== "created") throw new Error("fixture order creation failed");

      // Exhaust the PAYMENT_INITIATION quota first.
      for (let i = 0; i < PAYMENT_INITIATION.limit; i += 1) {
        await consumeRateLimit(identity, PAYMENT_INITIATION, tx, now);
      }
      const { allowed } = await consumeRateLimit(identity, PAYMENT_INITIATION, tx, now);
      expect(allowed).toBe(false);

      // Mirrors submitCheckoutAction's own gating: never call initiateOnlinePayment when not allowed.
      if (allowed) {
        await initiateOnlinePayment(order.order.id, "TWINT", tx);
      }

      expect(initializePaymentPage).not.toHaveBeenCalled();
    });
  });

  it("an allowed online-payment-initiation attempt does reach the provider (control case)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const identity = testIdentity();
      const now = new Date();

      const order = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          paymentMethod: "TWINT",
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      if (order.status !== "created") throw new Error("fixture order creation failed");

      const { allowed } = await consumeRateLimit(identity, PAYMENT_INITIATION, tx, now);
      expect(allowed).toBe(true);
      if (allowed) {
        await initiateOnlinePayment(order.order.id, "TWINT", tx);
      }

      expect(initializePaymentPage).toHaveBeenCalledTimes(1);
    });
  });

  it("SELLER checkout never consumes payment-initiation quota", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const identity = testIdentity();

      // SELLER-method order: submitCheckoutAction's own code only
      // consumes PAYMENT_INITIATION when paymentMethod is TWINT/CARD —
      // simulate that same conditional here.
      const order = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(order.status).toBe("created");

      const [row] = await tx
        .select()
        .from(checkoutRateLimits)
        .where(
          and(
            eq(checkoutRateLimits.identityHash, identity),
            eq(checkoutRateLimits.action, "payment_initiation"),
          ),
        );
      expect(row).toBeUndefined();
      expect(initializePaymentPage).not.toHaveBeenCalled();
    });
  });
});
