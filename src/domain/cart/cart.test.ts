import { describe, expect, it } from "vitest";
import { money } from "../money";
import type { PublicCatalog } from "../catalog/public-catalog";
import {
  addToCart,
  cartItemCount,
  cartSubtotal,
  createEmptyCart,
  purchasableCartCount,
  reconcileCartCampaign,
  removeFromCart,
  resolveCartAgainstCatalog,
  setQuantity,
} from "./cart";

const CAMPAIGN_ID = "campaign-1";
const WINE_ID = "wine-1";
const OTHER_WINE_ID = "wine-2";
const BUNDLE_ID = "bundle-1";

function activeCatalog(
  overrides: Partial<Extract<PublicCatalog, { state: "active" }>> = {},
): PublicCatalog {
  return {
    state: "active",
    campaign: { id: CAMPAIGN_ID, name: "Vente 2026", publicTitle: null, description: null },
    wines: [
      {
        id: WINE_ID,
        slug: "chasselas",
        name: "Chasselas",
        category: "WHITE",
        producer: null,
        vintage: null,
        region: null,
        grapeVariety: null,
        shortDescription: null,
        description: null,
        tastingNotes: null,
        imageUrl: null,
        price: money(1_800),
        displayOrder: 0,
      },
    ],
    bundles: [
      {
        id: BUNDLE_ID,
        slug: "carton-decouverte",
        name: "Carton découverte",
        shortDescription: null,
        description: null,
        imageUrl: null,
        price: money(10_000),
        items: [{ productId: WINE_ID, name: "Chasselas", quantity: 1 }],
        bottleCount: 1,
        displayOrder: 0,
      },
    ],
    ...overrides,
  };
}

describe("addToCart", () => {
  it("adds a product as a new line", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 3);
    expect(cart.items).toEqual([{ type: "PRODUCT", id: WINE_ID, quantity: 3 }]);
  });

  it("adds a bundle as a new line", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "BUNDLE", BUNDLE_ID, 1);
    expect(cart.items).toEqual([{ type: "BUNDLE", id: BUNDLE_ID, quantity: 1 }]);
  });

  it("adding the same (type, id) again increments quantity rather than duplicating", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 2);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 3);
    expect(cart.items).toEqual([{ type: "PRODUCT", id: WINE_ID, quantity: 5 }]);
  });

  it("a product and a bundle with the same id string stay distinct lines", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", "shared-id", 1);
    cart = addToCart(cart, "BUNDLE", "shared-id", 1);
    expect(cart.items).toHaveLength(2);
  });

  it("is a no-op for a zero, negative, or non-integer quantity", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 0);
    cart = addToCart(cart, "PRODUCT", WINE_ID, -1);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 1.5);
    expect(cart.items).toEqual([]);
  });
});

describe("setQuantity", () => {
  it("sets an absolute quantity on an existing line", () => {
    let cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 2);
    cart = setQuantity(cart, "PRODUCT", WINE_ID, 7);
    expect(cart.items).toEqual([{ type: "PRODUCT", id: WINE_ID, quantity: 7 }]);
  });

  it("creates a line if it doesn't already exist", () => {
    const cart = setQuantity(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 4);
    expect(cart.items).toEqual([{ type: "PRODUCT", id: WINE_ID, quantity: 4 }]);
  });

  it("quantity zero removes the line (BR-CART-003)", () => {
    let cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 2);
    cart = setQuantity(cart, "PRODUCT", WINE_ID, 0);
    expect(cart.items).toEqual([]);
  });

  it("a negative quantity also removes the line", () => {
    let cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 2);
    cart = setQuantity(cart, "PRODUCT", WINE_ID, -5);
    expect(cart.items).toEqual([]);
  });

  it("setting quantity to zero on an item that was never present is a harmless no-op", () => {
    const cart = setQuantity(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 0);
    expect(cart.items).toEqual([]);
  });
});

describe("removeFromCart", () => {
  it("removes the matching line and leaves others untouched", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 1);
    cart = addToCart(cart, "BUNDLE", BUNDLE_ID, 1);
    cart = removeFromCart(cart, "PRODUCT", WINE_ID);
    expect(cart.items).toEqual([{ type: "BUNDLE", id: BUNDLE_ID, quantity: 1 }]);
  });
});

describe("cartItemCount", () => {
  it("sums quantities across mixed product/bundle lines", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 3);
    cart = addToCart(cart, "BUNDLE", BUNDLE_ID, 2);
    expect(cartItemCount(cart)).toBe(5);
  });

  it("is zero for an empty cart", () => {
    expect(cartItemCount(createEmptyCart(CAMPAIGN_ID))).toBe(0);
  });
});

describe("resolveCartAgainstCatalog", () => {
  it("resolves an available product with its live name and price", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 3);
    const [line] = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(line).toMatchObject({
      available: true,
      name: "Chasselas",
      unitPrice: 1_800,
      lineTotal: 5_400,
    });
  });

  it("resolves an available bundle with its live name and price", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "BUNDLE", BUNDLE_ID, 2);
    const [line] = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(line).toMatchObject({
      available: true,
      name: "Carton découverte",
      unitPrice: 10_000,
      lineTotal: 20_000,
    });
  });

  it("marks a product no longer in the catalog as unavailable", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", "removed-product", 1);
    const [line] = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(line).toMatchObject({ available: false, name: null, unitPrice: null, lineTotal: null });
  });

  it("marks a bundle no longer in the catalog (or no longer valid) as unavailable", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "BUNDLE", "removed-bundle", 1);
    const [line] = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(line).toMatchObject({ available: false, name: null, unitPrice: null, lineTotal: null });
  });

  it("marks every line unavailable when there is no active campaign", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 1);
    const [line] = resolveCartAgainstCatalog(cart, { state: "no-active-campaign" });
    expect(line?.available).toBe(false);
  });

  it("resolves an unrelated second product as unavailable while the first stays available", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", OTHER_WINE_ID, 1);
    const [line] = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(line?.available).toBe(false);
  });
});

describe("purchasableCartCount", () => {
  it("counts only available lines", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 3);
    cart = addToCart(cart, "PRODUCT", "removed-product", 4);
    expect(purchasableCartCount(cart, activeCatalog())).toBe(3);
  });
});

describe("cartSubtotal", () => {
  it("uses exact integer minor units — no floating point drift across a mixed product+bundle cart", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 3); // 3 * 1800 = 5400
    cart = addToCart(cart, "BUNDLE", BUNDLE_ID, 2); // 2 * 10000 = 20000
    const lines = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(cartSubtotal(lines)).toBe(25_400);
  });

  it("excludes unavailable lines from the subtotal", () => {
    let cart = createEmptyCart(CAMPAIGN_ID);
    cart = addToCart(cart, "PRODUCT", WINE_ID, 1); // 1800
    cart = addToCart(cart, "PRODUCT", "removed-product", 10); // excluded
    const lines = resolveCartAgainstCatalog(cart, activeCatalog());
    expect(cartSubtotal(lines)).toBe(1_800);
  });

  it("is zero for an empty resolved cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("reconcileCartCampaign", () => {
  it("is a no-op when the campaign already matches", () => {
    const cart = addToCart(createEmptyCart(CAMPAIGN_ID), "PRODUCT", WINE_ID, 2);
    expect(reconcileCartCampaign(cart, CAMPAIGN_ID)).toEqual(cart);
  });

  it("assigns the campaign and KEEPS items when reconciling from the empty sentinel — the hydration/sync race this exists to fix", () => {
    const cart = addToCart(createEmptyCart(""), "PRODUCT", WINE_ID, 2);
    const reconciled = reconcileCartCampaign(cart, CAMPAIGN_ID);
    expect(reconciled).toEqual({
      campaignId: CAMPAIGN_ID,
      items: [{ type: "PRODUCT", id: WINE_ID, quantity: 2 }],
    });
  });

  it("discards items when reconciling from a genuinely different, already-known campaign", () => {
    const staleCart = addToCart(createEmptyCart("last-years-campaign"), "PRODUCT", WINE_ID, 5);
    const reconciled = reconcileCartCampaign(staleCart, CAMPAIGN_ID);
    expect(reconciled).toEqual({ campaignId: CAMPAIGN_ID, items: [] });
  });

  it("never merges — a stale cart's items are gone entirely, not combined with anything", () => {
    const staleCart = addToCart(createEmptyCart("old-campaign"), "BUNDLE", BUNDLE_ID, 3);
    const reconciled = reconcileCartCampaign(staleCart, CAMPAIGN_ID);
    expect(reconciled.items).toHaveLength(0);
  });
});
