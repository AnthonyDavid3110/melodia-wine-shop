import { type Money, multiplyMoney } from "../money";
import type { PublicCatalog } from "../catalog/public-catalog";

/**
 * Cart→Order authoritative resolution (Phase 7, docs/05-ARCHITECTURE.md
 * §20, BR-CHK-001/002). Deliberately the *rejecting* sibling of
 * `domain/cart/cart.ts`'s `resolveCartAgainstCatalog`: the cart marks an
 * unavailable line and keeps going (a browsing concern), but order
 * creation must refuse the whole submission the moment any line can't
 * be resolved against the live campaign — a partially-honoured order is
 * never acceptable. Used identically by ONLINE checkout and MANUAL admin
 * entry (docs/10 §48 — "SAME server-side pricing").
 */
export interface OrderLineRequest {
  type: "PRODUCT" | "BUNDLE";
  id: string;
  quantity: number;
}

export interface ResolvedBundleComponent {
  productId: string;
  productName: string;
  quantityPerBundle: number;
}

export interface ResolvedOrderLine {
  type: "PRODUCT" | "BUNDLE";
  productId: string | null;
  bundleId: string | null;
  name: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  /** Only populated for BUNDLE lines — the order-time composition to snapshot into OrderBundleComponent. */
  bundleComponents: ResolvedBundleComponent[] | null;
}

export type ResolveOrderLinesResult =
  | { ok: true; lines: ResolvedOrderLine[] }
  | { ok: false; reason: "empty-cart" }
  | { ok: false; reason: "no-active-campaign" }
  | { ok: false; reason: "unavailable-items"; unavailable: OrderLineRequest[] };

function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 999;
}

export function resolveOrderLines(
  items: readonly OrderLineRequest[],
  catalog: PublicCatalog,
): ResolveOrderLinesResult {
  if (items.length === 0) {
    return { ok: false, reason: "empty-cart" };
  }
  if (catalog.state !== "active") {
    return { ok: false, reason: "no-active-campaign" };
  }

  const wineById = new Map(catalog.wines.map((wine) => [wine.id, wine]));
  const bundleById = new Map(catalog.bundles.map((bundle) => [bundle.id, bundle]));

  const lines: ResolvedOrderLine[] = [];
  const unavailable: OrderLineRequest[] = [];

  for (const item of items) {
    if (!isValidQuantity(item.quantity)) {
      unavailable.push(item);
      continue;
    }

    if (item.type === "PRODUCT") {
      const wine = wineById.get(item.id);
      if (!wine) {
        unavailable.push(item);
        continue;
      }
      lines.push({
        type: "PRODUCT",
        productId: wine.id,
        bundleId: null,
        name: wine.name,
        unitPrice: wine.price,
        quantity: item.quantity,
        lineTotal: multiplyMoney(wine.price, item.quantity),
        bundleComponents: null,
      });
      continue;
    }

    const bundle = bundleById.get(item.id);
    if (!bundle) {
      unavailable.push(item);
      continue;
    }
    lines.push({
      type: "BUNDLE",
      productId: null,
      bundleId: bundle.id,
      name: bundle.name,
      unitPrice: bundle.price,
      quantity: item.quantity,
      lineTotal: multiplyMoney(bundle.price, item.quantity),
      bundleComponents: bundle.items.map((component) => ({
        productId: component.productId,
        productName: component.name,
        quantityPerBundle: component.quantity,
      })),
    });
  }

  if (unavailable.length > 0) {
    return { ok: false, reason: "unavailable-items", unavailable };
  }
  return { ok: true, lines };
}
