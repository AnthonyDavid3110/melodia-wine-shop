import { describe, expect, it } from "vitest";
import { money } from "../money";
import type { PublicCatalog } from "../catalog/public-catalog";
import { resolveOrderLines } from "./resolve-order-lines";

const WINE_ID = "wine-1";
const OTHER_WINE_ID = "wine-2";
const BUNDLE_ID = "bundle-1";

function activeCatalog(): PublicCatalog {
  return {
    state: "active",
    campaign: { id: "campaign-1", name: "Vente 2026", publicTitle: null, description: null },
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
  };
}

describe("resolveOrderLines", () => {
  it("rejects an empty cart", () => {
    const result = resolveOrderLines([], activeCatalog());
    expect(result).toEqual({ ok: false, reason: "empty-cart" });
  });

  it("rejects when there is no active campaign", () => {
    const result = resolveOrderLines([{ type: "PRODUCT", id: WINE_ID, quantity: 1 }], {
      state: "no-active-campaign",
    });
    expect(result).toEqual({ ok: false, reason: "no-active-campaign" });
  });

  it("resolves a product line with authoritative name/price, ignoring nothing from the request", () => {
    const result = resolveOrderLines(
      [{ type: "PRODUCT", id: WINE_ID, quantity: 3 }],
      activeCatalog(),
    );
    expect(result).toMatchObject({
      ok: true,
      lines: [
        {
          type: "PRODUCT",
          productId: WINE_ID,
          bundleId: null,
          name: "Chasselas",
          unitPrice: 1_800,
          quantity: 3,
          lineTotal: 5_400,
          bundleComponents: null,
        },
      ],
    });
  });

  it("resolves a bundle line and includes its component snapshot", () => {
    const result = resolveOrderLines(
      [{ type: "BUNDLE", id: BUNDLE_ID, quantity: 2 }],
      activeCatalog(),
    );
    expect(result).toMatchObject({
      ok: true,
      lines: [
        {
          type: "BUNDLE",
          bundleId: BUNDLE_ID,
          productId: null,
          name: "Carton découverte",
          unitPrice: 10_000,
          quantity: 2,
          lineTotal: 20_000,
          bundleComponents: [
            { productId: WINE_ID, productName: "Chasselas", quantityPerBundle: 1 },
          ],
        },
      ],
    });
  });

  it("rejects the whole submission when any single line is unavailable — never a partial order", () => {
    const result = resolveOrderLines(
      [
        { type: "PRODUCT", id: WINE_ID, quantity: 1 },
        { type: "PRODUCT", id: "removed-product", quantity: 1 },
      ],
      activeCatalog(),
    );
    expect(result).toEqual({
      ok: false,
      reason: "unavailable-items",
      unavailable: [{ type: "PRODUCT", id: "removed-product", quantity: 1 }],
    });
  });

  it("rejects an unknown bundle id", () => {
    const result = resolveOrderLines(
      [{ type: "BUNDLE", id: "removed-bundle", quantity: 1 }],
      activeCatalog(),
    );
    expect(result).toMatchObject({ ok: false, reason: "unavailable-items" });
  });

  it("rejects a non-catalog product id even if syntactically well-formed", () => {
    const result = resolveOrderLines(
      [{ type: "PRODUCT", id: OTHER_WINE_ID, quantity: 1 }],
      activeCatalog(),
    );
    expect(result).toMatchObject({ ok: false, reason: "unavailable-items" });
  });

  it.each([0, -1, 1.5, NaN, Infinity, 1000])("rejects an invalid quantity: %p", (quantity) => {
    const result = resolveOrderLines([{ type: "PRODUCT", id: WINE_ID, quantity }], activeCatalog());
    expect(result).toMatchObject({ ok: false, reason: "unavailable-items" });
  });

  it("never trusts a browser-submitted price — the request shape has no price field to even smuggle one in", () => {
    const maliciousRequest = { type: "PRODUCT", id: WINE_ID, quantity: 1, unitPrice: 1 } as never;
    const result = resolveOrderLines([maliciousRequest], activeCatalog());
    expect(result).toMatchObject({ ok: true, lines: [{ unitPrice: 1_800 }] });
  });
});
