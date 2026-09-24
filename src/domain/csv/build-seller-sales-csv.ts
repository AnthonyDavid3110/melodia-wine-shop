import { buildCsvDocument, csvCell, csvTextCell } from "./csv-cell";
import { formatCsvMoney } from "./format-csv-money";

/**
 * `seller-sales.csv` — per-seller campaign summary (Phase 12 Gate 12A,
 * approved Step 1 §1/§7/§8). Reuses whatever figures the caller
 * computed via the existing `calculateSellerSales`/
 * `calculateSellerCollections`/`calculateSellerProgress` calculators
 * (`src/infrastructure/settlements/settlements.ts`'s
 * `listCampaignSellerSalesSummaries()`) — this builder does not
 * recompute anything, it only formats. `sellerId === null` represents
 * the synthetic "Non attribuée" row for unassigned orders (approved
 * §7): `target`/`progressPercentage` stay empty for it, since neither
 * concept applies to unassigned orders.
 */
export interface SellerSalesExportRow {
  sellerId: string | null;
  sellerName: string | null;
  orderCount: number;
  sales: number;
  target: number | null;
  progressPercentage: number | null;
  stillToCollect: number;
  collected: number;
  stillToRemit: number;
  remittedToEcm: number;
}

const HEADER = [
  "vendeur",
  "nombreCommandes",
  "ventesCHF",
  "objectifCHF",
  "progressionPct",
  "resteAEncaisserCHF",
  "encaisseCHF",
  "resteARemettreCHF",
  "remisAMelodiaCHF",
];

const UNASSIGNED_LABEL = "Non attribuée";

export function buildSellerSalesCsv(rows: readonly SellerSalesExportRow[]): string {
  const csvRows = rows.map((row) => [
    csvTextCell(row.sellerName ?? UNASSIGNED_LABEL),
    csvCell(row.orderCount),
    csvCell(formatCsvMoney(row.sales)),
    csvCell(row.target === null ? "" : formatCsvMoney(row.target)),
    csvCell(row.progressPercentage === null ? "" : row.progressPercentage),
    csvCell(formatCsvMoney(row.stillToCollect)),
    csvCell(formatCsvMoney(row.collected)),
    csvCell(formatCsvMoney(row.stillToRemit)),
    csvCell(formatCsvMoney(row.remittedToEcm)),
  ]);
  return buildCsvDocument(HEADER, csvRows);
}
