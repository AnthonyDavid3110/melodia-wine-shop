import type { Cart, CartItem, CartItemType } from "./cart";

/**
 * Pure, DOM-free localStorage serialization (Phase 6 §4/§11). No
 * `window`/`localStorage` access happens here — the actual browser I/O
 * (itself wrapped in try/catch, since even referencing
 * `window.localStorage` can throw in some private-browsing modes) lives
 * in `cart-context.tsx`, so this module stays unit-testable with plain
 * strings in and `Cart | null` out.
 */
export const CART_STORAGE_VERSION = 1;
export const CART_STORAGE_KEY = "melodia:cart";

interface StoredCartV1 {
  version: 1;
  campaignId: string;
  items: { type: CartItemType; id: string; quantity: number }[];
}

function isCartItemType(value: unknown): value is CartItemType {
  return value === "PRODUCT" || value === "BUNDLE";
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0
  );
}

/**
 * Parses a raw persisted string into a `Cart`, or `null` if it cannot
 * be trusted at all (missing, malformed JSON, wrong/missing version,
 * malformed campaign id). Malformed *individual items* are dropped
 * silently rather than discarding the whole cart, and duplicate
 * `(type, id)` pairs are merged (quantities summed) — the version this
 * writes back can never itself contain duplicates, but past/foreign
 * data might.
 */
export function parseStoredCart(raw: string | null | undefined): Cart | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.version !== CART_STORAGE_VERSION) {
    return null;
  }
  if (typeof obj.campaignId !== "string" || obj.campaignId.trim() === "") {
    return null;
  }
  if (!Array.isArray(obj.items)) {
    return null;
  }

  const merged = new Map<string, CartItem>();
  for (const rawItem of obj.items) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }
    const candidate = rawItem as Record<string, unknown>;
    if (!isCartItemType(candidate.type)) {
      continue;
    }
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
      continue;
    }
    if (!isPositiveInteger(candidate.quantity)) {
      continue;
    }

    const key = `${candidate.type}:${candidate.id}`;
    const existing = merged.get(key);
    merged.set(key, {
      type: candidate.type,
      id: candidate.id,
      quantity: (existing?.quantity ?? 0) + candidate.quantity,
    });
  }

  return { campaignId: obj.campaignId, items: Array.from(merged.values()) };
}

export function serializeCart(cart: Cart): string {
  const stored: StoredCartV1 = {
    version: CART_STORAGE_VERSION,
    campaignId: cart.campaignId,
    items: cart.items.map(({ type, id, quantity }) => ({ type, id, quantity })),
  };
  return JSON.stringify(stored);
}
