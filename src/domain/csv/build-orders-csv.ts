import {
  customerPaymentStatusLabel,
  orderSourceLabel,
  orderStatusLabel,
  paymentMethodLabel,
  sellerSettlementStatusLabel,
} from "@/domain/orders/order-labels";
import { buildCsvDocument, csvCell, csvTextCell } from "./csv-cell";
import { formatCsvDate, formatCsvDateTime } from "./format-csv-date";
import { formatCsvMoney } from "./format-csv-money";
import {
  selectAuthoritativePaymentForExport,
  type PaymentAttemptForExportSelection,
} from "./select-authoritative-payment-for-export";

/**
 * `orders.csv` — the administrative/reconciliation export (Phase 12
 * Gate 12A, approved Step 1 §1). One row per order, INCLUDING
 * `CANCELLED` orders (approved §6) — this is audit/history data, not
 * an operational-preparation view. `sellerName` is a live seller-table
 * reference, not an order-time snapshot (accepted, documented V1
 * limitation, no migration).
 */
export interface OrderExportRow {
  orderNumber: string;
  createdAt: Date;
  source: string;
  status: string;
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  customerEmail: string;
  customerPhone: string;
  deliveryNote: string | null;
  /** Live `sellers` reference; `null` for an unassigned order. */
  sellerName: string | null;
  totalAmount: number;
  customerPaymentStatus: string;
  sellerSettlementStatus: string;
  payments: readonly PaymentAttemptForExportSelection[];
}

const HEADER = [
  "numeroCommande",
  "dateCreation",
  "source",
  "statut",
  "client",
  "adresse",
  "npa",
  "localite",
  "email",
  "telephone",
  "noteLivraison",
  "vendeur",
  "montantTotalCHF",
  "modePaiement",
  "statutPaiementClient",
  "fournisseur",
  "referenceFournisseur",
  "datePaiement",
  "statutReglementVendeur",
];

export function buildOrdersCsv(rows: readonly OrderExportRow[]): string {
  const csvRows = rows.map((row) => {
    const payment = selectAuthoritativePaymentForExport(row.payments);
    return [
      csvCell(row.orderNumber),
      csvCell(formatCsvDate(row.createdAt)),
      csvCell(orderSourceLabel(row.source)),
      csvCell(orderStatusLabel(row.status)),
      csvTextCell(`${row.customerFirstName} ${row.customerLastName}`),
      csvTextCell(row.customerAddress),
      csvTextCell(row.customerPostalCode),
      csvTextCell(row.customerCity),
      csvTextCell(row.customerEmail),
      csvTextCell(row.customerPhone),
      csvTextCell(row.deliveryNote),
      csvTextCell(row.sellerName ?? "Non attribuée"),
      csvCell(formatCsvMoney(row.totalAmount)),
      csvCell(payment ? paymentMethodLabel(payment.method) : ""),
      csvCell(customerPaymentStatusLabel(row.customerPaymentStatus)),
      csvCell(payment?.provider ?? ""),
      csvCell(payment?.providerPaymentId ?? ""),
      csvCell(formatCsvDateTime(payment?.paidAt ?? null)),
      csvCell(sellerSettlementStatusLabel(row.sellerSettlementStatus)),
    ];
  });
  return buildCsvDocument(HEADER, csvRows);
}
