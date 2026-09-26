import { eq, inArray } from "drizzle-orm";
import { db } from "../database/client";
import { orderItems, orders } from "../database/schema";

type DbHandle = Pick<typeof db, "select">;

export interface CampaignSalesItemRow {
  orderId: string;
  orderStatus: string;
  itemType: "PRODUCT" | "BUNDLE";
  productId: string | null;
  bundleId: string | null;
  /** Order-time snapshot — never a live Product/Bundle name (BR-PRO-002/BR-PRI-003). */
  nameSnapshot: string;
  quantity: number;
  lineTotalAmount: number;
}

/**
 * Every commercial order line for a campaign (Phase 13 Gate 13C), for
 * the "sales by wine"/"sales by bundle" statistics. Deliberately
 * narrower than `listOrdersForCampaignExport()` (which this page does
 * NOT reuse) — that query also loads seller/payment/bundle-component
 * data this page never needs, at CSV-export scale. Two queries total
 * (orders, then their items via `inArray`), no N+1. Bundle components
 * are intentionally not loaded here — bundle composition is not shown
 * on this page (approved Step 1 §5); wine bottle counts (which DO need
 * bundle-inclusive detail) come from the separate, already-existing
 * `getCampaignWineRequirements()`, not from this function.
 */
export async function getCampaignItemSalesBreakdown(
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<CampaignSalesItemRow[]> {
  const campaignOrders = await dbHandle
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.campaignId, campaignId));
  if (campaignOrders.length === 0) {
    return [];
  }

  const statusByOrderId = new Map(campaignOrders.map((order) => [order.id, order.status]));
  const items = await dbHandle
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        campaignOrders.map((order) => order.id),
      ),
    );

  return items.map((item) => ({
    orderId: item.orderId,
    orderStatus: statusByOrderId.get(item.orderId)!,
    itemType: item.itemType,
    productId: item.productId,
    bundleId: item.bundleId,
    nameSnapshot: item.nameSnapshot,
    quantity: item.quantity,
    lineTotalAmount: item.lineTotalAmount,
  }));
}
