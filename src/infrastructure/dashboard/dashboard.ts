import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../database/client";
import { orders, payments, sellers } from "../database/schema";

type DbHandle = Pick<typeof db, "select">;

/**
 * The full campaign order set (every status, including CANCELLED — the
 * dashboard's own pure calculators are responsible for excluding it
 * where required, not this query) with seller and payment rows batched
 * in, for the operational dashboard (Phase 13 Gate 13B). Mirrors
 * `listOrdersForCampaignExport()`'s payment-batching shape, minus
 * items/bundle components (the dashboard needs no line-item detail) —
 * two queries total regardless of order count.
 */
export async function getCampaignDashboardOrders(campaignId: string, dbHandle: DbHandle = db) {
  const rows = await dbHandle
    .select({ order: orders, seller: sellers })
    .from(orders)
    .leftJoin(sellers, eq(orders.sellerId, sellers.id))
    .where(eq(orders.campaignId, campaignId))
    .orderBy(desc(orders.createdAt));

  const orderIds = rows.map((row) => row.order.id);
  const paymentsByOrderId = new Map<string, (typeof payments.$inferSelect)[]>();
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
  }

  return rows.map((row) => ({
    order: row.order,
    seller: row.seller,
    payments: paymentsByOrderId.get(row.order.id) ?? [],
  }));
}

export type CampaignDashboardOrderRow = Awaited<
  ReturnType<typeof getCampaignDashboardOrders>
>[number];
