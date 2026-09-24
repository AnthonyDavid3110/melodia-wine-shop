import { and, desc, eq, inArray } from "drizzle-orm";
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
import {
  canCancelOrder,
  canMarkCustomerPaymentReceived,
  canReassignSeller,
} from "@/domain/orders/order-guards";

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

/** Phase 8 approved decision #2 — cancellation blocked once money has moved (BR-CAN, docs/09-SECURITY.md §67). */
export class OrderNotCancellableError extends Error {
  constructor() {
    super(
      "Cette commande a déjà été payée ou réglée à Mélodia et ne peut pas être annulée depuis ce flux. Un futur processus d'annulation financière sera nécessaire.",
    );
    this.name = "OrderNotCancellableError";
  }
}

/** Phase 8 approved decision #1 — reassignment blocked once a completed settlement already reflects the current seller. */
export class SellerReassignmentBlockedError extends Error {
  constructor() {
    super(
      "Le vendeur de cette commande a déjà remis l'argent à Mélodia dans un règlement finalisé et ne peut plus être modifié.",
    );
    this.name = "SellerReassignmentBlockedError";
  }
}

/** Phase 8 mark-payment-received guard failure — covers not-found-payment, wrong method, already-paid, and cancelled cases with one clean admin-facing message. */
export class OrderNotPayableError extends Error {
  constructor() {
    super("Le paiement de cette commande ne peut pas être marqué comme reçu actuellement.");
    this.name = "OrderNotPayableError";
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

/**
 * Phase 12 Gate 12A — the full per-campaign order/item/payment read
 * model behind `orders.csv`/`order-items.csv`. Deliberately includes
 * `CANCELLED` orders (approved Step 1 §6, unlike
 * `listCampaignFulfilmentOrders()`) — these exports are audit/
 * reconciliation history, not an operational-preparation view. Four
 * queries total regardless of order count (batched via `inArray`,
 * mirroring `fulfilment.ts`'s `loadOrderItemsWithBundleComponents()`
 * idiom) — never one query per order.
 */
export async function listOrdersForCampaignExport(campaignId: string, dbHandle: DbHandle = db) {
  const rows = await dbHandle
    .select({ order: orders, seller: sellers })
    .from(orders)
    .leftJoin(sellers, eq(orders.sellerId, sellers.id))
    .where(eq(orders.campaignId, campaignId))
    .orderBy(desc(orders.createdAt));

  const orderIds = rows.map((row) => row.order.id);
  const paymentsByOrderId = new Map<string, (typeof payments.$inferSelect)[]>();
  const itemsByOrderId = new Map<string, (typeof orderItems.$inferSelect)[]>();
  const componentsByItemId = new Map<string, (typeof orderBundleComponents.$inferSelect)[]>();

  if (orderIds.length > 0) {
    const orderPayments = await dbHandle
      .select()
      .from(payments)
      .where(inArray(payments.orderId, orderIds));
    for (const payment of orderPayments) {
      const list = paymentsByOrderId.get(payment.orderId) ?? [];
      list.push(payment);
      paymentsByOrderId.set(payment.orderId, list);
    }

    const items = await dbHandle
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    const itemIds = items.map((item) => item.id);
    if (itemIds.length > 0) {
      const components = await dbHandle
        .select()
        .from(orderBundleComponents)
        .where(inArray(orderBundleComponents.orderItemId, itemIds));
      for (const component of components) {
        const list = componentsByItemId.get(component.orderItemId) ?? [];
        list.push(component);
        componentsByItemId.set(component.orderItemId, list);
      }
    }
  }

  return rows.map((row) => ({
    order: row.order,
    seller: row.seller,
    payments: paymentsByOrderId.get(row.order.id) ?? [],
    items: (itemsByOrderId.get(row.order.id) ?? []).map((item) => ({
      ...item,
      bundleComponents: componentsByItemId.get(item.id) ?? [],
    })),
  }));
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

    if (!canReassignSeller(existing)) {
      throw new SellerReassignmentBlockedError();
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
 * Cancels an order (Phase 7 §20, BR-CAN-001/002; tightened in Phase 8).
 * Never deletes the row. Once money has moved — `customerPaymentStatus
 * = PAID` or `sellerSettlementStatus = SETTLED` — cancellation is
 * blocked entirely rather than silently leaving stale financial state
 * attached to a cancelled order; a future reversal/refund workflow is
 * required for that case, never invented here (Phase 8 approved
 * decision #2). `canCancelOrder` is the single source of truth for this
 * rule, shared with the UI's own visibility check.
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
    if (!canCancelOrder(existing)) {
      throw new OrderNotCancellableError();
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

/**
 * The customer → seller half of Phase 8's offline money flow
 * (docs/04-DATA-MODEL.md §20, docs/08-PAYMENTS.md §31-32). Updates the
 * order's SELLER/OFFLINE `Payment` row and `Order.customerPaymentStatus`
 * atomically in one transaction — these must never drift apart. Never
 * touches a TWINT/CARD payment: the method check keeps this action
 * completely isolated from the future online-payment path, which will
 * be confirmed only through trusted provider callbacks (BR-PAY-006),
 * never through this admin action.
 *
 * A repeat call (double click, retry) is a clean, safe no-op-as-
 * rejection: `canMarkCustomerPaymentReceived` fails once
 * `customerPaymentStatus` is no longer PENDING, so a second invocation
 * throws the same typed `OrderNotPayableError` rather than creating a
 * second Payment row, re-setting `paidAt`, or writing a duplicate
 * event.
 */
export async function markCustomerPaymentReceived(
  id: string,
  adminUserId: string,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }
    if (!canMarkCustomerPaymentReceived(existing)) {
      throw new OrderNotPayableError();
    }

    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, id), eq(payments.method, "SELLER")));
    if (!payment || payment.status !== "PENDING") {
      throw new OrderNotPayableError();
    }

    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "SUCCEEDED", paidAt: now })
      .where(eq(payments.id, payment.id));

    const [updated] = await tx
      .update(orders)
      .set({ customerPaymentStatus: "PAID" })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "CUSTOMER_PAYMENT_MARKED_PAID",
      actorType: "ADMIN",
      adminUserId,
    });

    return updated!;
  });
}
