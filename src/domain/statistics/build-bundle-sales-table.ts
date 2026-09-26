import { type Money, addMoney, money } from "../money";

export interface BundleSalesItemInput {
  orderStatus: string;
  itemType: "PRODUCT" | "BUNDLE";
  bundleId: string | null;
  nameSnapshot: string;
  quantity: number;
  lineTotalAmount: Money;
}

export interface BundleSalesRow {
  bundleId: string;
  name: string;
  quantitySold: number;
  revenue: Money;
}

/**
 * "Sales by bundle" (docs/06-ADMIN-SPEC.md §50) — groups `itemType =
 * BUNDLE` order lines by `bundleId`, using the order-time
 * `nameSnapshot` (never a live Bundle name). Composition is
 * deliberately not included (approved Step 1 §5) — this is a sales
 * summary, not a preparation view.
 */
export function buildBundleSalesTable(items: readonly BundleSalesItemInput[]): BundleSalesRow[] {
  const byBundleId = new Map<string, { name: string; quantitySold: number; revenue: Money }>();
  for (const item of items) {
    if (item.orderStatus === "CANCELLED") continue;
    if (item.itemType !== "BUNDLE" || !item.bundleId) continue;
    const existing = byBundleId.get(item.bundleId) ?? {
      name: item.nameSnapshot,
      quantitySold: 0,
      revenue: money(0),
    };
    byBundleId.set(item.bundleId, {
      name: item.nameSnapshot,
      quantitySold: existing.quantitySold + item.quantity,
      revenue: addMoney(existing.revenue, item.lineTotalAmount),
    });
  }

  return Array.from(byBundleId.entries())
    .map(([bundleId, group]) => ({ bundleId, ...group }))
    .sort((a, b) => b.revenue - a.revenue);
}
