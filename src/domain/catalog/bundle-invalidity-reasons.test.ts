import { describe, expect, it } from "vitest";
import { diagnoseBundleInvalidity } from "./bundle-invalidity-reasons";
import { isBundleValid } from "./shape-public-catalog";

describe("diagnoseBundleInvalidity", () => {
  it("returns no reasons for a valid bundle (same rule as isBundleValid)", () => {
    const items = [
      { productId: "p1", productName: "Chasselas", productActive: true },
      { productId: "p2", productName: "Pinot Noir", productActive: true },
    ];
    const campaignProducts = [
      { productId: "p1", active: true },
      { productId: "p2", active: true },
    ];

    expect(diagnoseBundleInvalidity(items, campaignProducts)).toEqual([]);

    // Cross-check against the real validity rule, never diverging from it.
    const visibleProductIds = new Set(["p1", "p2"]);
    expect(
      isBundleValid(
        {
          id: "b1",
          slug: "b1",
          name: "Carton",
          shortDescription: null,
          description: null,
          imageUrl: null,
          priceAmount: 1000,
          displayOrder: 0,
          items: items.map((i) => ({ productId: i.productId, quantity: 1 })),
        },
        visibleProductIds,
      ),
    ).toBe(true);
  });

  it("reports an empty composition distinctly, without inspecting campaignProducts", () => {
    expect(diagnoseBundleInvalidity([], [{ productId: "p1", active: true }])).toEqual([
      {
        productId: "",
        productName: "",
        code: "empty-composition",
        message: "Ce carton ne contient aucun vin.",
      },
    ]);
  });

  it("reports a component no longer attached to the campaign", () => {
    const items = [{ productId: "p1", productName: "Merlot", productActive: true }];
    const result = diagnoseBundleInvalidity(items, []);

    expect(result).toEqual([
      {
        productId: "p1",
        productName: "Merlot",
        code: "not-attached-to-campaign",
        message: "« Merlot » n'est plus attaché à cette campagne.",
      },
    ]);
  });

  it("reports a component deactivated for this campaign specifically (campaign_products.active = false)", () => {
    const items = [{ productId: "p1", productName: "Gamaret", productActive: true }];
    const campaignProducts = [{ productId: "p1", active: false }];

    expect(diagnoseBundleInvalidity(items, campaignProducts)).toEqual([
      {
        productId: "p1",
        productName: "Gamaret",
        code: "inactive-in-campaign",
        message: "« Gamaret » a été désactivé pour cette campagne.",
      },
    ]);
  });

  it("reports a component deactivated at the product level (products.active = false) — the Neon Demo case", () => {
    const items = [{ productId: "p1", productName: "L'Enjoleur", productActive: false }];
    const campaignProducts = [{ productId: "p1", active: true }];

    expect(diagnoseBundleInvalidity(items, campaignProducts)).toEqual([
      {
        productId: "p1",
        productName: "L'Enjoleur",
        code: "product-inactive",
        message: "« L'Enjoleur » a été désactivé (fiche produit).",
      },
    ]);
  });

  it("reports every failing component, not just the first one", () => {
    const items = [
      { productId: "p1", productName: "Chasselas", productActive: true },
      { productId: "p2", productName: "L'Enjoleur", productActive: false },
      { productId: "p3", productName: "Galotta", productActive: true },
    ];
    const campaignProducts = [
      { productId: "p1", active: true },
      { productId: "p2", active: true },
      // p3 deliberately absent — not attached to the campaign.
    ];

    const result = diagnoseBundleInvalidity(items, campaignProducts);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.productId)).toEqual(["p2", "p3"]);
    expect(result[0]!.code).toBe("product-inactive");
    expect(result[1]!.code).toBe("not-attached-to-campaign");
  });
});
