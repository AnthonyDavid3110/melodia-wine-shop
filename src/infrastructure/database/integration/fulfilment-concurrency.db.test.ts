import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  InvalidFulfilmentTransitionError,
  bulkPrepareOrders,
  handOrderToSeller,
  markOrderDelivered,
  markOrderPrepared,
} from "@/infrastructure/fulfilment/fulfilment";
import { FulfilmentConflictError, cancelOrder } from "@/infrastructure/orders/orders";
import { adminUsers, campaigns, orderEvents, orders, sellers } from "../schema";
import { unique } from "./fixtures";
import { db } from "./setup";

/**
 * Phase 14 Gate 14D — deterministic proof that the compare-and-set
 * invariant (`UPDATE orders SET status = <target> WHERE id = ? AND
 * status = <expected source> RETURNING ...`) actually holds under
 * GENUINE concurrent transactions, not merely sequential calls.
 *
 * Real COMMITTED transactions on purpose (not `withRollback`) — Gate
 * 14D's own Step 1 established that `withRollback` wraps everything in
 * one outer transaction/connection with nested SAVEPOINTs, so it cannot
 * represent two independently-committing transactions racing each
 * other at all (see `fulfilment-transitions.db.test.ts` for the
 * ordinary, sequential, `withRollback`-based coverage this file
 * deliberately does NOT duplicate).
 *
 * Mirrors `create-order-concurrency.db.test.ts`'s own established,
 * safer pattern: uses the REAL seeded ACTIVE campaign WITHOUT ever
 * mutating its status (never flips DRAFT/ACTIVE) — this file has no
 * need for a different active campaign, so it never touches that
 * global single-ACTIVE-campaign invariant at all, sidestepping the
 * entire risk class behind the Gate 14B corruption incident. Every
 * fixture row (product, campaignProduct, seller, admin, order, and
 * whatever events/orders a test creates) is test-owned, tracked, and
 * removed in `afterEach` — including after an assertion failure or a
 * genuine conflict, since `afterEach` always runs.
 */

async function getRealActiveCampaign() {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) {
    throw new Error(
      "This suite requires a seeded ACTIVE campaign (run `pnpm db:seed` if the local DB is empty).",
    );
  }
  return campaign;
}

const createdSellerIds: string[] = [];
const createdAdminIds: string[] = [];
const createdOrderIds: string[] = [];

async function createTestSeller() {
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique("Seller"), active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  return seller;
}

async function createTestAdmin() {
  const [admin] = await db
    .insert(adminUsers)
    .values({ email: `${unique("admin")}@example.test`, name: "Test Admin" })
    .returning();
  if (!admin) throw new Error("fixture insert failed");
  createdAdminIds.push(admin.id);
  return admin;
}

async function createTestOrder(
  campaignId: string,
  status: "CONFIRMED" | "PREPARED" | "HANDED_TO_SELLER",
  overrides: Partial<typeof orders.$inferInsert> = {},
) {
  const [order] = await db
    .insert(orders)
    .values({
      orderNumber: unique("ECM-CONCURRENCY"),
      campaignId,
      source: "ONLINE",
      customerFirstName: "Jean",
      customerLastName: "Testeur",
      customerAddress: "Rue Example 1",
      customerPostalCode: "1000",
      customerCity: "Lausanne",
      customerEmail: "jean.testeur@example.test",
      customerPhone: "+41 79 000 00 00",
      subtotalAmount: 1_800,
      totalAmount: 1_800,
      status,
      ...overrides,
    })
    .returning();
  if (!order) throw new Error("fixture insert failed");
  createdOrderIds.push(order.id);
  return order;
}

async function eventsFor(orderId: string) {
  return db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId));
}

/**
 * The losing side of a genuine race can legitimately fail two different
 * ways depending on real timing, both correct: if its own initial
 * (unlocked) read happens BEFORE the winner commits, it passes its own
 * validation and only fails at the authoritative conditional UPDATE
 * (`FulfilmentConflictError`); if its initial read happens AFTER the
 * winner already committed, its own ordinary stale-state guard rejects
 * it first (`InvalidFulfilmentTransitionError`) — explicitly accepted
 * by the approved Gate 14D plan §2: "a later ordinary retry ... may
 * still hit the existing invalid-transition guard before reaching the
 * authoritative UPDATE. That is acceptable." Both mean the same thing
 * to the caller: the transition did not happen, truthfully reported.
 */
function expectTruthfulConflictRejection(reason: unknown) {
  expect(reason).toBeInstanceOf(Error);
  const isAcceptableClass =
    reason instanceof FulfilmentConflictError || reason instanceof InvalidFulfilmentTransitionError;
  expect(isAcceptableClass).toBe(true);
}

afterEach(async () => {
  const orderIds = createdOrderIds.splice(0);
  if (orderIds.length > 0) {
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }

  const sellerIds = createdSellerIds.splice(0);
  if (sellerIds.length > 0) {
    await db.delete(sellers).where(inArray(sellers.id, sellerIds));
  }

  const adminIds = createdAdminIds.splice(0);
  if (adminIds.length > 0) {
    await db.delete(adminUsers).where(inArray(adminUsers.id, adminIds));
  }
});

describe("fulfilment concurrency — same transition twice (A)", () => {
  it("two concurrent markOrderPrepared calls on the same CONFIRMED order: exactly one succeeds, one conflicts, one event", async () => {
    const campaign = await getRealActiveCampaign();
    const admin = await createTestAdmin();
    const order = await createTestOrder(campaign.id, "CONFIRMED");

    const results = await Promise.allSettled([
      markOrderPrepared(order.id, admin.id, db),
      markOrderPrepared(order.id, admin.id, db),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expectTruthfulConflictRejection((rejected[0] as PromiseRejectedResult).reason);

    const [persisted] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(persisted?.status).toBe("PREPARED");

    // (D) The losing call must not have produced its own success event —
    // exactly one ORDER_PREPARED event exists for this order, never two.
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("ORDER_PREPARED");
  });
});

describe("fulfilment concurrency — fulfilment vs cancellation (B)", () => {
  it("handOrderToSeller racing cancelOrder from PREPARED: exactly one wins, the event history matches whichever did", async () => {
    const campaign = await getRealActiveCampaign();
    const admin = await createTestAdmin();
    const seller = await createTestSeller();
    const order = await createTestOrder(campaign.id, "PREPARED", { sellerId: seller.id });

    const results = await Promise.allSettled([
      handOrderToSeller(order.id, admin.id, db),
      cancelOrder(order.id, admin.id, db),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expectTruthfulConflictRejection((rejected[0] as PromiseRejectedResult).reason);

    const [persisted] = await db.select().from(orders).where(eq(orders.id, order.id));
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);

    // Either winner is valid — assert the invariant (status and event
    // history agree, exactly one of each), never which one wins.
    if (persisted?.status === "HANDED_TO_SELLER") {
      expect(events[0]?.type).toBe("ORDER_HANDED_TO_SELLER");
    } else {
      expect(persisted?.status).toBe("CANCELLED");
      expect(events[0]?.type).toBe("ORDER_CANCELLED");
    }
  });
});

describe("fulfilment concurrency — delivery vs cancellation (C)", () => {
  it("markOrderDelivered racing cancelOrder from HANDED_TO_SELLER: exactly one wins, coherent event history", async () => {
    const campaign = await getRealActiveCampaign();
    const admin = await createTestAdmin();
    const seller = await createTestSeller();
    const order = await createTestOrder(campaign.id, "HANDED_TO_SELLER", { sellerId: seller.id });

    const results = await Promise.allSettled([
      markOrderDelivered(order.id, admin.id, db),
      cancelOrder(order.id, admin.id, db),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expectTruthfulConflictRejection((rejected[0] as PromiseRejectedResult).reason);

    const [persisted] = await db.select().from(orders).where(eq(orders.id, order.id));
    const events = await eventsFor(order.id);
    expect(events).toHaveLength(1);

    if (persisted?.status === "DELIVERED") {
      expect(events[0]?.type).toBe("ORDER_DELIVERED");
    } else {
      expect(persisted?.status).toBe("CANCELLED");
      expect(events[0]?.type).toBe("ORDER_CANCELLED");
    }
  });
});

describe("fulfilment concurrency — bulk vs a concurrent single-order transition (E)", () => {
  /**
   * Genuinely deterministic orchestration of "one selected order changes
   * between validation and the authoritative bulk write" would require
   * either an arbitrary sleep (forbidden — flaky) or a test-only
   * synchronization hook inside `bulkPrepareOrders` itself (forbidden —
   * no production code exists solely to pause a transaction for a
   * test). Neither is used here. Instead this races the real
   * `bulkPrepareOrders` transaction against a real, independent
   * `markOrderPrepared` call targeting ONE shared order via genuine
   * concurrent connections (`Promise.allSettled`, no sleep) — the
   * strongest non-invasive deterministic DB test available for this
   * boundary. Two outcomes are both legitimate and both assert the
   * required invariant, never a specific winner:
   *
   * (a) both transactions' own validation SELECT observe the row as
   *     still CONFIRMED (neither has committed yet) and race on the
   *     UPDATE itself — this is the case that exercises the NEW bulk
   *     compare-and-set conflict path directly;
   * (b) the single-order call commits first, so by the time the bulk
   *     transaction's own per-row validation loop re-reads the row it
   *     is already PREPARED — this is correctly caught by the
   *     PRE-EXISTING `InvalidBulkFulfilmentSelectionError` validation
   *     path (never reaching the new compare-and-set UPDATE at all),
   *     and the entire batch (including the OTHER, non-conflicting
   *     order) rolls back — proving all-or-nothing holds even when the
   *     conflict is caught earlier than the new code.
   *
   * Both outcomes are asserted below; which one actually occurs depends
   * on real connection/scheduling timing and is not controlled by this
   * test, exactly as instructed for scenarios where either winner is
   * valid.
   */
  it("bulkPrepareOrders racing a single markOrderPrepared on one shared order: the invariant holds under either real outcome", async () => {
    const campaign = await getRealActiveCampaign();
    const admin = await createTestAdmin();
    const orderA = await createTestOrder(campaign.id, "CONFIRMED");
    const orderB = await createTestOrder(campaign.id, "CONFIRMED");

    const [bulkResult, singleResult] = await Promise.allSettled([
      bulkPrepareOrders({
        campaignId: campaign.id,
        orderIds: [orderA.id, orderB.id],
        adminId: admin.id,
      }),
      markOrderPrepared(orderA.id, admin.id, db),
    ]);

    const [persistedA] = await db.select().from(orders).where(eq(orders.id, orderA.id));
    const [persistedB] = await db.select().from(orders).where(eq(orders.id, orderB.id));
    const eventsA = await eventsFor(orderA.id);
    const eventsB = await eventsFor(orderB.id);

    if (bulkResult.status === "fulfilled") {
      // Outcome (a): bulk won the race on the shared order — both A and
      // B are PREPARED (all-or-nothing succeeded), the single call lost
      // and produced zero events.
      expect(singleResult.status).toBe("rejected");
      if (singleResult.status === "rejected") {
        expectTruthfulConflictRejection(singleResult.reason);
      }
      expect(persistedA?.status).toBe("PREPARED");
      expect(persistedB?.status).toBe("PREPARED");
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0]?.type).toBe("ORDER_PREPARED");
      expect(eventsB).toHaveLength(1);
      expect(eventsB[0]?.type).toBe("ORDER_PREPARED");
    } else {
      // Outcome (b): the single call won — the bulk batch's own
      // validation loop then correctly rejects the WHOLE batch
      // (pre-existing InvalidBulkFulfilmentSelectionError path), so B
      // (the non-conflicting member) remains untouched, never
      // transitioned by the failed batch, and carries no event at all.
      expect(singleResult.status).toBe("fulfilled");
      expect(persistedA?.status).toBe("PREPARED");
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0]?.type).toBe("ORDER_PREPARED");
      expect(persistedB?.status).toBe("CONFIRMED");
      expect(eventsB).toHaveLength(0);
    }
  });
});

describe("fulfilment concurrency — event-insert failure rolls back the preceding status UPDATE", () => {
  it("a non-existent adminUserId (FK violation on the event insert) leaves the order's status unchanged", async () => {
    const campaign = await getRealActiveCampaign();
    const order = await createTestOrder(campaign.id, "CONFIRMED");
    const nonExistentAdminId = randomUUID();

    await expect(markOrderPrepared(order.id, nonExistentAdminId, db)).rejects.toThrow();

    const [persisted] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(persisted?.status).toBe("CONFIRMED");
    expect(persisted?.preparedAt).toBeNull();

    const events = await db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.type, "ORDER_PREPARED")));
    expect(events).toHaveLength(0);
  });
});
