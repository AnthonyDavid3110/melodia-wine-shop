import { type Money, addMoney, money } from "../money";

export interface WineRequirementInput {
  productId: string;
  productName: string;
  bottles: number;
}

export interface WineSalesItemInput {
  orderStatus: string;
  itemType: "PRODUCT" | "BUNDLE";
  productId: string | null;
  lineTotalAmount: Money;
}

export interface WineSalesRow {
  productId: string;
  name: string;
  bottles: number;
  /** Commercial value of DIRECT (non-bundle) sales only — never allocated bundle revenue (no authoritative allocation rule exists). */
  directRevenue: Money;
}

/**
 * "Sales by wine" (docs/06-ADMIN-SPEC.md §50). `bottles` comes from
 * `getCampaignWineRequirements()` (bundle-inclusive, the authoritative
 * source — not recomputed here) and `directRevenue` is summed only from
 * `itemType = PRODUCT` order lines. The two columns deliberately do not
 * share a population: a wine sold only inside bundles has `bottles > 0`
 * and `directRevenue = 0` — this is correct, not a bug, and must be
 * labelled clearly in the UI (approved Step 1 §4).
 */
export function buildWineSalesTable(
  wineRequirements: readonly WineRequirementInput[],
  items: readonly WineSalesItemInput[],
): WineSalesRow[] {
  const directRevenueByProductId = new Map<string, Money>();
  for (const item of items) {
    if (item.orderStatus === "CANCELLED") continue;
    if (item.itemType !== "PRODUCT" || !item.productId) continue;
    const existing = directRevenueByProductId.get(item.productId) ?? money(0);
    directRevenueByProductId.set(item.productId, addMoney(existing, item.lineTotalAmount));
  }

  return wineRequirements
    .map((wine) => ({
      productId: wine.productId,
      name: wine.productName,
      bottles: wine.bottles,
      directRevenue: directRevenueByProductId.get(wine.productId) ?? money(0),
    }))
    .sort((a, b) => b.directRevenue - a.directRevenue);
}
