import { formatCHF, money } from "@/domain/money";
import { ORGANISATION_IDENTITY } from "./organisation-identity";

/**
 * Phase 12 Gate 12C — pure content model for the two customer-facing
 * commercial documents (order confirmation, receipt). No DB access, no
 * React, no `@react-pdf/renderer` import, no HTTP, no auth, no env —
 * matches the exact constraints already established for
 * `build-preparation-sheet-content.ts` (Gate 12B).
 *
 * Deliberately a DISTINCT type from `PreparationSheetContent`, not a
 * reuse/extension of it: the two documents have genuinely different
 * shapes (this one needs unit price/line total and organisation
 * identity; it must never carry seller name, phone, delivery note, or
 * fulfilment checkboxes, which the preparation sheet legitimately
 * has). Keeping them separate prevents one document from accidentally
 * inheriting a field meant only for the other.
 *
 * ECM is not VAT-registered (approved decision) — no VAT field exists
 * anywhere in this model, deliberately, not merely left empty.
 */

export type OrderDocumentVariant = "ORDER_CONFIRMATION" | "RECEIPT";

export interface OrderDocumentOrderInput {
  orderNumber: string;
  createdAt: Date;
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  totalAmount: number;
  customerPaymentStatus: string;
}

export interface OrderDocumentBundleComponentInput {
  productNameSnapshot: string;
  quantityPerBundle: number;
}

export interface OrderDocumentItemInput {
  itemType: "PRODUCT" | "BUNDLE";
  nameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
  bundleComponents: readonly OrderDocumentBundleComponentInput[];
}

export interface OrderDocumentItemContent {
  name: string;
  quantity: number;
  unitPriceFormatted: string;
  lineTotalFormatted: string;
  /** Informational only — never a priced row (approved: no fabricated component prices). */
  composition: readonly { name: string; quantityPerBundle: number }[];
}

export interface OrderDocumentContent {
  variant: OrderDocumentVariant;
  title: string;
  organisationName: string;
  organisationAddressLines: readonly string[];
  orderReference: string;
  orderDate: string;
  customerName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  items: readonly OrderDocumentItemContent[];
  totalAmountFormatted: string;
  paymentMethodLabel: string;
  /** `null` for ORDER_CONFIRMATION unless a payment method is already known; always set for RECEIPT. */
  paymentStatusLine: string | null;
}

/** Customer-facing phrasing, deliberately distinct from the admin-facing `paymentMethodLabel()` ("Membre") — approved wording. */
function customerFacingPaymentMethodLabel(method: string): string {
  switch (method) {
    case "TWINT":
      return "TWINT";
    case "CARD":
      return "Carte";
    case "SELLER":
      return "Paiement au membre ECM";
    default:
      return method;
  }
}

function formatOrderDate(date: Date): string {
  return date.toLocaleDateString("fr-CH");
}

function buildItems(items: readonly OrderDocumentItemInput[]): OrderDocumentItemContent[] {
  return items.map((item) => ({
    name: item.nameSnapshot,
    quantity: item.quantity,
    unitPriceFormatted: formatCHF(money(item.unitPriceAmount)),
    lineTotalFormatted: formatCHF(money(item.lineTotalAmount)),
    composition: item.bundleComponents.map((component) => ({
      name: component.productNameSnapshot,
      quantityPerBundle: component.quantityPerBundle,
    })),
  }));
}

function buildSharedFields(
  order: OrderDocumentOrderInput,
  items: readonly OrderDocumentItemInput[],
  paymentMethod: string | null,
) {
  return {
    organisationName: ORGANISATION_IDENTITY.name,
    organisationAddressLines: ORGANISATION_IDENTITY.addressLines,
    orderReference: order.orderNumber,
    orderDate: formatOrderDate(order.createdAt),
    customerName: `${order.customerFirstName} ${order.customerLastName}`,
    customerAddress: order.customerAddress,
    customerPostalCode: order.customerPostalCode,
    customerCity: order.customerCity,
    items: buildItems(items),
    totalAmountFormatted: formatCHF(money(order.totalAmount)),
    paymentMethodLabel: paymentMethod ? customerFacingPaymentMethodLabel(paymentMethod) : "",
  };
}

/** Eligible for every non-CANCELLED order, regardless of payment status. */
export function canGenerateOrderConfirmation(order: { status: string }): boolean {
  return order.status !== "CANCELLED";
}

/**
 * Eligible ONLY once payment is confirmed PAID, and never for a
 * CANCELLED order — both checked explicitly (not inferred from one
 * alone), even though `canCancelOrder()` already makes a PAID+CANCELLED
 * combination unreachable in practice (`src/domain/orders/order-guards.ts`
 * blocks cancellation once `customerPaymentStatus === "PAID"`). This
 * guard is the runtime half of the safety property; `buildReceiptContent()`
 * below adds a compile-time half. Written as a TypeScript type
 * predicate (`order is T & {...}`) so a caller that checks
 * `if (canGenerateReceipt(order))` gets `order.customerPaymentStatus`
 * narrowed to the literal `"PAID"` automatically within that branch —
 * exactly satisfying `buildReceiptContent()`'s parameter type with no
 * separate, duplicate narrowing check needed at the call site.
 */
export function canGenerateReceipt<T extends { status: string; customerPaymentStatus: string }>(
  order: T,
): order is T & { customerPaymentStatus: "PAID" } {
  return order.status !== "CANCELLED" && order.customerPaymentStatus === "PAID";
}

export function buildOrderConfirmationContent(
  order: OrderDocumentOrderInput,
  items: readonly OrderDocumentItemInput[],
  paymentMethod: string | null,
): OrderDocumentContent {
  return {
    variant: "ORDER_CONFIRMATION",
    title: "Confirmation de commande",
    paymentStatusLine: null,
    ...buildSharedFields(order, items, paymentMethod),
  };
}

/**
 * The `customerPaymentStatus: "PAID"` literal in the parameter type is
 * the compile-time half of the "never claim payment when not PAID"
 * guarantee — a caller cannot pass an unnarrowed `Order` here; the
 * type only accepts one whose `customerPaymentStatus` has already been
 * checked to be exactly `"PAID"` at the call site. Combined with the
 * runtime `canGenerateReceipt()` guard above, this makes the failure
 * mode "RECEIPT claims payment was received when it wasn't" doubly
 * unreachable, not merely unlikely.
 */
export function buildReceiptContent(
  order: OrderDocumentOrderInput & { customerPaymentStatus: "PAID" },
  items: readonly OrderDocumentItemInput[],
  paymentMethod: string | null,
): OrderDocumentContent {
  return {
    variant: "RECEIPT",
    title: "Reçu",
    // Exact approved wording — deliberately NOT derived from
    // customerPaymentStatusLabel() ("Payée"), which doesn't match the
    // approved masculine agreement with "Paiement".
    paymentStatusLine: "Paiement : Payé",
    ...buildSharedFields(order, items, paymentMethod),
  };
}
