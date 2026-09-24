import { formatCHF, money } from "@/domain/money";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import type { PreparationSheetContent } from "./build-preparation-sheet-content";

/**
 * Phase 12 Gate 12B — seller preparation PDF content model: a seller-
 * level header followed by the SAME per-order content
 * (`PreparationSheetContent`) the individual PDF already produces —
 * never a second representation of an order (approved Step 2 §4).
 * Pure — no DB, no React, no PDF library.
 */
export interface SellerPreparationSummaryContent {
  sellerName: string;
  campaignName: string;
  orderCount: number;
  totalBottles: number;
  totalSalesFormatted: string;
  orders: readonly PreparationSheetContent[];
}

export interface SellerPreparationSummarySellerInput {
  firstName: string;
  lastName: string;
}

/**
 * `salesTotal` is the already-computed authoritative figure from
 * `listCampaignSellerSalesSummaries()` (Gate 12A) — never
 * recalculated here. `orderContents` are already-built
 * `PreparationSheetContent` values (via `buildPreparationSheetContent`
 * per order), so bottle totals are summed from that shared model
 * rather than recomputed independently.
 */
export function buildSellerPreparationSummaryContent(
  seller: SellerPreparationSummarySellerInput,
  campaignName: string,
  salesTotal: number,
  orderContents: readonly PreparationSheetContent[],
): SellerPreparationSummaryContent {
  return {
    sellerName: formatSellerName(seller),
    campaignName,
    orderCount: orderContents.length,
    totalBottles: orderContents.reduce((sum, order) => sum + order.totalBottles, 0),
    totalSalesFormatted: formatCHF(money(salesTotal)),
    orders: orderContents,
  };
}
