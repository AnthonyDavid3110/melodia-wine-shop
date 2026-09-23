import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  adminUsers,
  campaignProducts,
  campaigns,
  orderEvents,
  orders,
  payments,
  products,
} from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

/**
 * Phase 11 Gate 11C — manual admin resend, DB-integration level.
 *
 * `resendOrderConfirmation()` has no `dbHandle === db` gate (unlike the
 * two Gate 11B automatic dispatch paths) — it always uses whatever
 * handle its caller passes, so `withRollback()` is both safe (real
 * transactional isolation) and sufficient here; no manual cleanup or
 * real-committed-connection dance is needed, unlike
 * `order-confirmation-email.db.test.ts`'s Gate 11B suite. The email
 * provider is still mocked, structurally — this file is the ONLY
 * `withRollback`-based suite in the codebase that CAN reach real
 * dispatch code (the ~15 other `withRollback` suites are excluded by
 * the `dbHandle === db` guard, which this path doesn't have), so it
 * needs the mock even though most sibling `withRollback` suites don't.
 */

// `importOriginal` preserves the real Email*Error classes —
// `classifyEmailFailure()` does `instanceof` checks against them.
vi.mock("@/infrastructure/email/resend-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/email/resend-provider")>();
  return { ...actual, sendEmail: vi.fn() };
});

const { sendEmail: mockedSendEmail, EmailNetworkError } =
  await import("@/infrastructure/email/resend-provider");
const { resendOrderConfirmation } = await import("@/infrastructure/email/order-confirmation");

beforeEach(() => {
  vi.mocked(mockedSendEmail).mockReset();
});

async function setupActiveCampaign(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
  const [campaign] = await tx
    .insert(campaigns)
    .values({
      name: unique("Campaign"),
      slug: unique("campaign"),
      status: "ACTIVE",
      openingDate: new Date("2026-09-01T00:00:00Z"),
    })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  return campaign;
}

async function setupCampaignProduct(tx: Tx, campaignId: string, unitPriceAmount = 1_800) {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique("wine"), name: unique("Wine"), category: "WHITE", active: true })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  const [campaignProduct] = await tx
    .insert(campaignProducts)
    .values({ campaignId, productId: product.id, unitPriceAmount, active: true })
    .returning();
  if (!campaignProduct) throw new Error("fixture insert failed");
  return campaignProduct;
}

/** `orderEvents.adminUserId` is a real UUID FK to `adminUsers.id` — a plain string like "admin-1" fails at the DB level (invalid UUID / FK violation), aborting the whole transaction. */
async function setupAdmin(tx: Tx) {
  const [admin] = await tx
    .insert(adminUsers)
    .values({ email: `${unique("resend-admin")}@example.test`, name: "Resend Test Admin" })
    .returning();
  if (!admin) throw new Error("fixture insert failed");
  return admin;
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

async function createTestOrder(
  tx: Tx,
  campaignProductId: string,
  overrides: {
    source?: "ONLINE" | "MANUAL";
    paymentMethod?: "SELLER" | "TWINT" | "CARD";
    manualAdminId?: string;
  } = {},
) {
  const result = await createOrder(
    customerInput({
      items: [{ type: "PRODUCT", id: campaignProductId, quantity: 1 }],
      paymentMethod: overrides.paymentMethod,
    }),
    overrides.source === "MANUAL"
      ? { type: "ADMIN", adminUserId: overrides.manualAdminId! }
      : { type: "SYSTEM" },
    overrides.source ?? "ONLINE",
    tx,
  );
  if (result.status !== "created") {
    throw new Error("fixture order creation failed");
  }
  return result;
}

const SELLER_PENDING_PAYMENTS = [
  { provider: "OFFLINE" as const, method: "SELLER" as const, status: "PENDING" as const },
];

describe("resendOrderConfirmation — DB integration", () => {
  it("eligible public SELLER order: sends SELLER_PAYMENT, records ADMIN_RESEND event, business state unchanged", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "resend-db-1" });
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);

      const before = await tx.select().from(orders).where(eq(orders.id, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        created.order,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "SENT" });
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      // Recipient is server-derived from the persisted order, never a parameter.
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: created.order.customerEmail }),
      );

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, created.order.id));
      const resendEvents = events.filter(
        (e) =>
          e.type === "EMAIL_SENT" &&
          (e.metadata as { trigger?: string })?.trigger === "ADMIN_RESEND",
      );
      expect(resendEvents).toHaveLength(1);
      expect(resendEvents[0]?.actorType).toBe("ADMIN");
      expect(resendEvents[0]?.adminUserId).toBe(admin.id);
      expect((resendEvents[0]?.metadata as { variant?: string })?.variant).toBe("SELLER_PAYMENT");

      const after = await tx.select().from(orders).where(eq(orders.id, created.order.id));
      expect(after[0]).toEqual(before[0]);
    });
  });

  it("eligible MANUAL order: sends SELLER_PAYMENT — proves resend works even though MANUAL never gets automatic dispatch", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "resend-db-2" });
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId, {
        source: "MANUAL",
        manualAdminId: admin.id,
      });

      // Gate 11B automatic dispatch never fires for MANUAL.
      expect(mockedSendEmail).not.toHaveBeenCalled();

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        created.order,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "SENT" });
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  it("eligible ONLINE_PAID order: sends ONLINE_PAID", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "resend-db-3" });
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId, {
        paymentMethod: "TWINT",
      });

      // Simulates the PERSISTED RESULT of a genuine online success
      // (already exhaustively proven end-to-end by Gate 10/11B's own
      // suites) — never re-drives the full Saferpay flow here.
      await tx.insert(payments).values({
        orderId: created.order.id,
        method: "TWINT",
        provider: "SAFERPAY",
        amount: created.order.totalAmount,
        currency: "CHF",
        status: "SUCCEEDED",
        paidAt: new Date(),
        providerPaymentId: `txn-${unique("fixture")}`,
      });
      await tx
        .update(orders)
        .set({ customerPaymentStatus: "PAID" })
        .where(eq(orders.id, created.order.id));

      const [order] = await tx.select().from(orders).where(eq(orders.id, created.order.id));
      const orderPayments = await tx
        .select()
        .from(payments)
        .where(eq(payments.orderId, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        order!,
        created.items,
        orderPayments,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "SENT" });
      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, created.order.id));
      const sent = events.find((e) => e.type === "EMAIL_SENT");
      expect((sent?.metadata as { variant?: string })?.variant).toBe("ONLINE_PAID");
    });
  });

  it("SELLER order already marked PAID: INELIGIBLE, zero send, zero misleading event", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);
      await tx
        .update(orders)
        .set({ customerPaymentStatus: "PAID" })
        .where(eq(orders.id, created.order.id));
      const [order] = await tx.select().from(orders).where(eq(orders.id, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        order!,
        created.items,
        [{ provider: "OFFLINE", method: "SELLER", status: "SUCCEEDED" }],
        admin.id,
      );

      expect(resendResult).toEqual({ status: "INELIGIBLE", reason: "seller-payment-not-pending" });
      expect(mockedSendEmail).not.toHaveBeenCalled();
      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, created.order.id));
      expect(events.some((e) => e.type === "EMAIL_SENT" || e.type === "EMAIL_FAILED")).toBe(false);
    });
  });

  it("pending/failed/cancelled online payment: INELIGIBLE, zero send", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);

      for (const status of ["PENDING", "FAILED", "CANCELLED"] as const) {
        const created = await createTestOrder(tx, campaignProduct.productId, {
          paymentMethod: "TWINT",
        });
        await tx.insert(payments).values({
          orderId: created.order.id,
          method: "TWINT",
          provider: "SAFERPAY",
          amount: created.order.totalAmount,
          currency: "CHF",
          status,
        });

        const resendResult = await resendOrderConfirmation(
          tx,
          created.order.id,
          created.order,
          created.items,
          [{ provider: "SAFERPAY", method: "TWINT", status }],
          admin.id,
        );

        expect(resendResult).toEqual({
          status: "INELIGIBLE",
          reason: "online-payment-not-completed",
        });
      }
      expect(mockedSendEmail).not.toHaveBeenCalled();
    });
  });

  it("CANCELLED order: INELIGIBLE regardless of underlying payment method", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);
      await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, created.order.id));
      const [order] = await tx.select().from(orders).where(eq(orders.id, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        order!,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "INELIGIBLE", reason: "order-cancelled" });
    });
  });

  it("fulfilment progression alone does not remove eligibility (DELIVERED, still customer-unpaid)", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "resend-db-7" });
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);
      await tx.update(orders).set({ status: "DELIVERED" }).where(eq(orders.id, created.order.id));
      const [order] = await tx.select().from(orders).where(eq(orders.id, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        order!,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "SENT" });
    });
  });

  it("provider failure: returns FAILED, records EMAIL_FAILED with ADMIN_RESEND trigger, business state unchanged", async () => {
    vi.mocked(mockedSendEmail).mockRejectedValue(new EmailNetworkError());
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);
      const before = await tx.select().from(orders).where(eq(orders.id, created.order.id));

      const resendResult = await resendOrderConfirmation(
        tx,
        created.order.id,
        created.order,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(resendResult).toEqual({ status: "FAILED" });
      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, created.order.id));
      const failed = events.find((e) => e.type === "EMAIL_FAILED");
      expect(failed).toBeTruthy();
      expect(failed?.actorType).toBe("ADMIN");
      expect((failed?.metadata as { trigger?: string })?.trigger).toBe("ADMIN_RESEND");

      const after = await tx.select().from(orders).where(eq(orders.id, created.order.id));
      expect(after[0]).toEqual(before[0]);
    });
  });

  it("an intentional second manual resend actually sends again (never suppressed by key reuse)", async () => {
    vi.mocked(mockedSendEmail).mockResolvedValue({ messageId: "resend-db-9" });
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const campaignProduct = await setupCampaignProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const created = await createTestOrder(tx, campaignProduct.productId);

      const first = await resendOrderConfirmation(
        tx,
        created.order.id,
        created.order,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );
      const second = await resendOrderConfirmation(
        tx,
        created.order.id,
        created.order,
        created.items,
        SELLER_PENDING_PAYMENTS,
        admin.id,
      );

      expect(first).toEqual({ status: "SENT" });
      expect(second).toEqual({ status: "SENT" });
      expect(mockedSendEmail).toHaveBeenCalledTimes(2);
      const keys = vi
        .mocked(mockedSendEmail)
        .mock.calls.map((call) => call[0]?.idempotencyKey as string);
      expect(keys[0]).not.toBe(keys[1]);

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, created.order.id));
      expect(events.filter((e) => e.type === "EMAIL_SENT")).toHaveLength(2);
    });
  });
});
