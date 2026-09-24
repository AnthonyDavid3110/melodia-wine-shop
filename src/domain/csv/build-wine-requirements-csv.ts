import { calculateCartonBreakdown } from "@/domain/fulfilment/calculate-carton-breakdown";
import { buildCsvDocument, csvCell, csvTextCell } from "./csv-cell";

/**
 * `wine-requirements.csv` — operational purchasing/preparation
 * requirements (Phase 12 Gate 12A, approved Step 1 §1/§6). Rows come
 * directly from `getCampaignWineRequirements()`
 * (`src/infrastructure/fulfilment/fulfilment.ts`), whose own
 * aggregation already excludes `CANCELLED` orders and decomposes
 * bundles into their snapshotted components (BR-REQ-001) — this
 * builder does not recompute requirements, it only formats them and
 * reuses the existing pure `calculateCartonBreakdown()` display
 * calculator for the optional carton columns.
 */
export interface WineRequirementExportRow {
  productName: string;
  bottles: number;
}

const HEADER = ["vin", "bouteilles", "cartons", "bouteillesRestantes"];

export function buildWineRequirementsCsv(rows: readonly WineRequirementExportRow[]): string {
  const csvRows = rows.map((row) => {
    const { cartons, looseBottles } = calculateCartonBreakdown(row.bottles);
    return [
      csvTextCell(row.productName),
      csvCell(row.bottles),
      csvCell(cartons),
      csvCell(looseBottles),
    ];
  });
  return buildCsvDocument(HEADER, csvRows);
}
