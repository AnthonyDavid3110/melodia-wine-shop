import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../database/client";
import {
  orderBundleComponents,
  orderEvents,
  orderItems,
  orders,
  payments,
  sellers,
} from "../database/schema";
import { listActiveCampaignSellers } from "../campaign/campaign-sellers";

type DbHandle = Pick<typeof db, "select" | "update" | "transaction">;

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Commande introuvable (${id}).`);
    this.name = "OrderNotFoundError";
  }
}

export class InvalidSellerAssignmentError extends Error {
  constructor() {
    super("Ce membre n'est pas éligible pour cette campagne.");
    this.name = "InvalidSellerAssignmentError";
  }
}

export class OrderAlreadyCancelledError extends Error {
  constructor() {
    super("Cette commande est déjà annulée.");
    this.name = "OrderAlreadyCancelledError";
  }
}

/**
 * Admin order list (Phase 7 §17/docs/06-ADMIN-SPEC.md §8/§9) —
 * left-joined with Sellers so unassigned orders (`sellerId = null`)
 * still appear (BR-SEL-004), never silently dropped by an inner join.
 * Client-side search/filter over this full list, matching the existing
 * Product/Seller admin list convention at this campaign's scale.
 */
export async function listOrders(dbHandle: DbHandle = db) {
  const rows = await dbHandle
    .select({ order: orders, seller: sellers })
    .from(orders)
    .leftJoin(sellers, eq(orders.sellerId, sellers.id))
    .orderBy(desc(orders.createdAt));
  return rows;
}

export async function getOrderDetail(id: string, dbHandle: DbHandle = db) {
  const [row] = await dbHandle
    .select({ order: orders, seller: sellers })
    .from(orders)
    .leftJoin(sellers, eq(orders.sellerId, sellers.id))
    .where(eq(orders.id, id));
  if (!row) {
    return null;
  }

  const items = await dbHandle.select().from(orderItems).where(eq(orderItems.orderId, id));
  const itemIds = items.map((item) => item.id);
  const bundleComponentsByItemId = new Map<string, (typeof orderBundleComponents.$inferSelect)[]>();
  if (itemIds.length > 0) {
    const components = await dbHandle
      .select()
      .from(orderBundleComponents)
      .where(inArray(orderBundleComponents.orderItemId, itemIds));
    for (const component of components) {
      const list = bundleComponentsByItemId.get(component.orderItemId) ?? [];
      list.push(component);
      bundleComponentsByItemId.set(component.orderItemId, list);
    }
  }

  const orderPayments = await dbHandle.select().from(payments).where(eq(payments.orderId, id));
  const events = await dbHandle
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, id))
    .orderBy(desc(orderEvents.createdAt));

  return {
    order: row.order,
    seller: row.seller,
    items: items.map((item) => ({
      ...item,
      bundleComponents: bundleComponentsByItemId.get(item.id) ?? [],
    })),
    payments: orderPayments,
    events,
  };
}

export interface CustomerInfoUpdate {
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  customerEmail: string;
  customerPhone: string;
  deliveryNote: string | null;
}

export async function updateOrderCustomerInfo(
  id: string,
  fields: CustomerInfoUpdate,
  adminUserId: string,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }

    const [updated] = await tx.update(orders).set(fields).where(eq(orders.id, id)).returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "ORDER_EDITED",
      actorType: "ADMIN",
      adminUserId,
      metadata: { fields: Object.keys(fields) },
    });

    return updated!;
  });
}

/**
 * Assign, reassign, or unassign an order's seller (Phase 7 §19,
 * BR-SEL-005). `sellerId: null` explicitly unassigns. A non-null id is
 * revalidated against the SAME `listActiveCampaignSellers` eligibility
 * checkout itself uses — an admin cannot assign an inactive/foreign-
 * campaign seller either. Never touches monetary totals or
 * payment/settlement state (BR-SEL-005's own text, and Phase 8's
 * concern respectively).
 */
export async function assignOrderSeller(
  id: string,
  sellerId: string | null,
  adminUserId: string,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }

    if (sellerId) {
      const eligible = await listActiveCampaignSellers(existing.campaignId, tx);
      if (!eligible.some((seller) => seller.id === sellerId)) {
        throw new InvalidSellerAssignmentError();
      }
    }

    const [updated] = await tx
      .update(orders)
      .set({ sellerId })
      .where(eq(orders.id, id))
      .returning();

    // No event at all for a no-op "reassign to the same value" call;
    // otherwise ASSIGNED only the first time (was unassigned), CHANGED
    // for every other real transition (including unassigning).
    const eventType =
      existing.sellerId === sellerId
        ? null
        : existing.sellerId === null
          ? "SELLER_ASSIGNED"
          : "SELLER_CHANGED";

    if (eventType) {
      await tx.insert(orderEvents).values({
        orderId: id,
        type: eventType,
        actorType: "ADMIN",
        adminUserId,
        metadata: { previousSellerId: existing.sellerId, newSellerId: sellerId },
      });
    }

    return updated!;
  });
}

/**
 * Cancels an order (Phase 7 §20, BR-CAN-001/002). Never deletes the
 * row. Phase 7's only invalid-transition case is cancelling an
 * already-cancelled order — every Phase-7-created order otherwise sits
 * at CONFIRMED (no PREPARED/HANDED_TO_SELLER/DELIVERED transitions
 * exist yet, those are Phase 9), so there is no richer state machine to
 * validate against here. Does NOT touch payment/settlement state — if
 * a paid order is later cancelled, resolving the resulting refund is
 * explicitly a future phase's concern (Phase 7 §20 instruction), never
 * silently implied by this function.
 */
export async function cancelOrder(id: string, adminUserId: string, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }
    if (existing.status === "CANCELLED") {
      throw new OrderAlreadyCancelledError();
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "ORDER_CANCELLED",
      actorType: "ADMIN",
      adminUserId,
    });

    return updated!;
  });
}
