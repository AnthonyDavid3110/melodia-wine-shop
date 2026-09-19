import { type Money, multiplyMoney } from "../money";
import { calculateOrderTotal } from "../orders/calculate-order-total";
import type { PublicCatalog } from "../catalog/public-catalog";

/**
 * Pure, DB-free guest-cart domain (Phase 6). Deliberately narrow —
 * identity + quantity only, never price/name snapshots (those are an
 * OrderItem concern, `04-DATA-MODEL.md` §15/§16, which doesn't exist
 * until checkout). Every price/name shown anywhere is always resolved
 * live against a freshly-fetched `PublicCatalog` via
 * `resolveCartAgainstCatalog` below — the cart itself never stores or
 * trusts one (`05-ARCHITECTURE.md` §19/§20, BR-CART-002).
 */
export type CartItemType = "PRODUCT" | "BUNDLE";

export interface CartItem {
  type: CartItemType;
  id: string;
  /** Always a positive integer — a non-positive quantity means "not in the cart" (BR-CART-003). */
  quantity: number;
}

export interface Cart {
  campaignId: string;
  items: CartItem[];
}

/** `campaignId: ""` is the deliberate sentinel for "no campaign known yet" — see `cart-context.tsx`'s hydration/reconciliation sequencing. */
export function createEmptyCart(campaignId: string): Cart {
  return { campaignId, items: [] };
}

/**
 * Reconciles a (hydrated) cart against the authoritative campaign id
 * (Phase 6 §5/§7 — "different active campaign => old cart is
 * discarded, never merged"). Pulled out as a pure function specifically
 * so this decision is unit-testable without React: `campaignId === ""`
 * is the "not yet assigned this session" sentinel, and reconciling
 * *from* it never discards items — a same-session item added in the
 * brief window between hydration completing and campaign discovery
 * completing belongs to the campaign about to be assigned, not to any
 * genuinely different campaign, so there's nothing stale to protect
 * against. Reconciling from any other, already-known campaign id that
 * doesn't match — a real prior-session/prior-year stored cart — *is*
 * genuinely stale and is discarded entirely, never merged.
 */
export function reconcileCartCampaign(cart: Cart, campaignId: string): Cart {
  if (cart.campaignId === campaignId) {
    return cart;
  }
  if (cart.campaignId === "") {
    return { ...cart, campaignId };
  }
  return createEmptyCart(campaignId);
}

function sameIdentity(
  a: { type: CartItemType; id: string },
  b: { type: CartItemType; id: string },
): boolean {
  return a.type === b.type && a.id === b.id;
}

/**
 * Adds `quantity` to the existing line for `(type, id)`, or creates a
 * new line — never a duplicate `(type, id)` entry. `quantity` must be a
 * positive integer; anything else is a no-op (defensive — callers are
 * expected to validate before calling, e.g. `QuantitySelector`'s own
 * `min`).
 */
export function addToCart(cart: Cart, type: CartItemType, id: string, quantity: number): Cart {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return cart;
  }
  const index = cart.items.findIndex((item) => sameIdentity(item, { type, id }));
  if (index === -1) {
    return { ...cart, items: [...cart.items, { type, id, quantity }] };
  }
  const items = [...cart.items];
  items[index] = { ...items[index]!, quantity: items[index]!.quantity + quantity };
  return { ...cart, items };
}

/**
 * Sets the absolute quantity for `(type, id)`. `quantity <= 0` removes
 * the line entirely (BR-CART-003) — this is the single place that rule
 * is enforced, so every caller (quantity stepper, explicit set) gets it
 * for free.
 */
export function setQuantity(cart: Cart, type: CartItemType, id: string, quantity: number): Cart {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return removeFromCart(cart, type, id);
  }
  if (!Number.isInteger(quantity)) {
    return cart;
  }
  const index = cart.items.findIndex((item) => sameIdentity(item, { type, id }));
  if (index === -1) {
    return { ...cart, items: [...cart.items, { type, id, quantity }] };
  }
  const items = [...cart.items];
  items[index] = { ...items[index]!, quantity };
  return { ...cart, items };
}

export function removeFromCart(cart: Cart, type: CartItemType, id: string): Cart {
  return { ...cart, items: cart.items.filter((item) => !sameIdentity(item, { type, id })) };
}

/** Raw sum of every line's quantity, regardless of current availability — use `purchasableCartCount` for the header badge. */
export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * A discriminated union, not a flat `boolean` + nullable fields — an
 * unavailable line structurally cannot carry a name/price, which is
 * also what keeps callers (`cart-view.tsx`) from needing a non-null
 * assertion after checking `available`.
 */
export type ResolvedCartLine =
  | { item: CartItem; available: true; name: string; unitPrice: Money; lineTotal: Money }
  | { item: CartItem; available: false; name: null; unitPrice: null; lineTotal: null };

/**
 * Cross-references stored cart identities against a freshly-fetched
 * `PublicCatalog` — the one and only place a cart item's name/price
 * comes from. `catalog.wines`/`catalog.bundles` already only contain
 * currently visible products and currently *valid* bundles
 * (`shapePublicCatalog`'s `isBundleValid` already filtered them), so an
 * id simply absent from those arrays covers every "unavailable" case at
 * once: globally inactive, hidden for this campaign, removed from the
 * campaign, or part of a bundle whose composition is no longer valid —
 * no second definition of bundle validity is needed here.
 */
export function resolveCartAgainstCatalog(cart: Cart, catalog: PublicCatalog): ResolvedCartLine[] {
  if (catalog.state !== "active") {
    return cart.items.map((item) => ({
      item,
      available: false,
      name: null,
      unitPrice: null,
      lineTotal: null,
    }));
  }

  const wineById = new Map(catalog.wines.map((wine) => [wine.id, wine]));
  const bundleById = new Map(catalog.bundles.map((bundle) => [bundle.id, bundle]));

  return cart.items.map((item) => {
    if (item.type === "PRODUCT") {
      const wine = wineById.get(item.id);
      if (!wine) {
        return { item, available: false, name: null, unitPrice: null, lineTotal: null };
      }
      return {
        item,
        available: true,
        name: wine.name,
        unitPrice: wine.price,
        lineTotal: multiplyMoney(wine.price, item.quantity),
      };
    }

    const bundle = bundleById.get(item.id);
    if (!bundle) {
      return { item, available: false, name: null, unitPrice: null, lineTotal: null };
    }
    return {
      item,
      available: true,
      name: bundle.name,
      unitPrice: bundle.price,
      lineTotal: multiplyMoney(bundle.price, item.quantity),
    };
  });
}

/** Sum of quantities across only currently-available lines — what the header badge displays. */
export function purchasableCartCount(cart: Cart, catalog: PublicCatalog): number {
  return resolveCartAgainstCatalog(cart, catalog)
    .filter((line) => line.available)
    .reduce((sum, line) => sum + line.item.quantity, 0);
}

/**
 * The cart subtotal — available lines only (BR-CART / Gate 2B
 * decision: unavailable lines never contribute). Reuses
 * `calculateOrderTotal` (BR-PRI-001) directly rather than
 * reimplementing "unit price × quantity, summed" a second time.
 */
export function cartSubtotal(lines: readonly ResolvedCartLine[]): Money {
  const available = lines.filter(
    (line): line is ResolvedCartLine & { unitPrice: Money } =>
      line.available && line.unitPrice !== null,
  );
  return calculateOrderTotal(
    available.map((line) => ({ unitPriceAmount: line.unitPrice, quantity: line.item.quantity })),
  ).total;
}
