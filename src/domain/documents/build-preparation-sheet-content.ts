import { formatCHF, money } from "@/domain/money";
import {
  customerPaymentStatusLabel as formatCustomerPaymentStatusLabel,
  paymentMethodLabel as formatPaymentMethodLabel,
} from "@/domain/orders/order-labels";
import { formatSellerName } from "@/domain/sellers/format-seller-name";

/**
 * Phase 12 Gate 12B — pure preparation-sheet content model, shared by
 * BOTH the individual order preparation PDF and each per-order section
 * of the seller preparation PDF (approved Step 1/Step 2: never two
 * representations of an order). No DB access, no React, no
 * `@react-pdf/renderer` import, no HTTP, no auth, no env — this module
 * only transforms already-fetched, authoritative data into structured
 * document semantics, independently unit-testable without touching a
 * renderer.
 */

export interface PreparationSheetOrderInput {
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  customerPhone: string;
  deliveryNote: string | null;
  totalAmount: number;
  customerPaymentStatus: string;
  preparedAt: Date | null;
  handedToSellerAt: Date | null;
}

export interface PreparationSheetBundleComponentInput {
  productNameSnapshot: string;
  quantityPerBundle: number;
}

export interface PreparationSheetItemInput {
  itemType: "PRODUCT" | "BUNDLE";
  nameSnapshot: string;
  quantity: number;
  bundleComponents: readonly PreparationSheetBundleComponentInput[];
}

export interface PreparationSheetSellerInput {
  firstName: string;
  lastName: string;
}

export interface PreparationSheetItemContent {
  type: "PRODUCT" | "BUNDLE";
  name: string;
  quantity: number;
  /** Empty for a PRODUCT row — matches Gate 12A's `order-items.csv` principle: never a separate, priced row per component. */
  composition: readonly { name: string; quantityPerBundle: number }[];
}

export interface PreparationSheetContent {
  orderNumber: string;
  customerName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  /** `null` when the order has no delivery note — caller decides whether to render a row at all. */
  deliveryNote: string | null;
  /** `null` for an unassigned order — the PDF renders "Non attribuée", matching Gate 12A's CSV wording. */
  sellerName: string | null;
  items: readonly PreparationSheetItemContent[];
  totalBottles: number;
  totalAmountFormatted: string;
  /** Empty string when no payment row exists yet for this order. */
  paymentMethodLabel: string;
  customerPaymentStatusLabel: string;
  isPrepared: boolean;
  isHandedToSeller: boolean;
}

/**
 * PRODUCT quantity counted directly; BUNDLE quantity × the sum of its
 * snapshot components' `quantityPerBundle` — the exact same formula
 * `src/infrastructure/fulfilment/fulfilment.ts`'s
 * `getCampaignOrderBottleCounts()` already uses, expressed here as a
 * pure, DB-free, single-order calculation (that function is
 * necessarily DB-bound and campaign-batched, so it can't be called
 * directly from this pure layer).
 */
function calculateTotalBottles(items: readonly PreparationSheetItemInput[]): number {
  let total = 0;
  for (const item of items) {
    if (item.itemType === "PRODUCT") {
      total += item.quantity;
      continue;
    }
    const bottlesPerBundle = item.bundleComponents.reduce(
      (sum, component) => sum + component.quantityPerBundle,
      0,
    );
    total += item.quantity * bottlesPerBundle;
  }
  return total;
}

/**
 * `paymentMethod` is already resolved by the caller (reusing
 * `selectAuthoritativePaymentForExport()` from the Gate 12A CSV
 * domain layer — the same one-row-per-order selection rule, never
 * reimplemented here) so this builder stays a pure formatting step.
 */
export function buildPreparationSheetContent(
  order: PreparationSheetOrderInput,
  items: readonly PreparationSheetItemInput[],
  seller: PreparationSheetSellerInput | null,
  paymentMethod: string | null,
): PreparationSheetContent {
  return {
    orderNumber: order.orderNumber,
    customerName: `${order.customerFirstName} ${order.customerLastName}`,
    address: order.customerAddress,
    postalCode: order.customerPostalCode,
    city: order.customerCity,
    phone: order.customerPhone,
    deliveryNote: order.deliveryNote,
    sellerName: seller ? formatSellerName(seller) : null,
    items: items.map((item) => ({
      type: item.itemType,
      name: item.nameSnapshot,
      quantity: item.quantity,
      composition: item.bundleComponents.map((component) => ({
        name: component.productNameSnapshot,
        quantityPerBundle: component.quantityPerBundle,
      })),
    })),
    totalBottles: calculateTotalBottles(items),
    totalAmountFormatted: formatCHF(money(order.totalAmount)),
    paymentMethodLabel: paymentMethod ? formatPaymentMethodLabel(paymentMethod) : "",
    customerPaymentStatusLabel: formatCustomerPaymentStatusLabel(order.customerPaymentStatus),
    isPrepared: order.preparedAt !== null,
    isHandedToSeller: order.handedToSellerAt !== null,
  };
}
