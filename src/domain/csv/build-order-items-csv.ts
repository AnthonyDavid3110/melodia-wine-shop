import { orderStatusLabel } from "@/domain/orders/order-labels";
import { buildCsvDocument, csvCell, csvTextCell } from "./csv-cell";
import { formatCsvMoney } from "./format-csv-money";

/**
 * `order-items.csv` — machine-readable order-line detail (Phase 12
 * Gate 12A, approved Step 1 §1/§5). One row per `orderItems` row,
 * INCLUDING lines belonging to `CANCELLED` orders (approved §6, with
 * `statutCommande` exposed explicitly so a consumer can filter/
 * reconcile). A BUNDLE row keeps its own snapshotted commercial price/
 * quantity/line total — bundle components are surfaced only as an
 * informational `composition` text column, never as separate money-
 * bearing rows (approved §5: no fabricated component prices, no
 * double-counting).
 */
export interface OrderItemBundleComponentExportInput {
  productNameSnapshot: string;
  quantityPerBundle: number;
}

export interface OrderItemExportRow {
  orderNumber: string;
  orderStatus: string;
  itemType: "PRODUCT" | "BUNDLE";
  nameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
  bundleComponents: readonly OrderItemBundleComponentExportInput[];
}

const HEADER = [
  "numeroCommande",
  "statutCommande",
  "type",
  "article",
  "composition",
  "quantite",
  "prixUnitaireCHF",
  "totalLigneCHF",
];

function itemTypeLabel(itemType: "PRODUCT" | "BUNDLE"): string {
  return itemType === "BUNDLE" ? "Bundle" : "Vin";
}

function formatComposition(components: readonly OrderItemBundleComponentExportInput[]): string {
  if (components.length === 0) {
    return "";
  }
  return components
    .map((component) => `${component.quantityPerBundle}× ${component.productNameSnapshot}`)
    .join("; ");
}

export function buildOrderItemsCsv(rows: readonly OrderItemExportRow[]): string {
  const csvRows = rows.map((row) => [
    csvCell(row.orderNumber),
    csvCell(orderStatusLabel(row.orderStatus)),
    csvCell(itemTypeLabel(row.itemType)),
    csvTextCell(row.nameSnapshot),
    csvTextCell(formatComposition(row.bundleComponents)),
    csvCell(row.quantity),
    csvCell(formatCsvMoney(row.unitPriceAmount)),
    csvCell(formatCsvMoney(row.lineTotalAmount)),
  ]);
  return buildCsvDocument(HEADER, csvRows);
}
