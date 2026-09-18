import { describe, expect, it } from "vitest";
import { money } from "../money";
import {
  shapePublicCatalog,
  type BundleRow,
  type CampaignProductRow,
} from "./shape-public-catalog";
import type { PublicCampaign } from "./public-catalog";

const campaign: PublicCampaign = {
  id: "campaign-1",
  name: "Les Vins de Mélodia 2026",
  publicTitle: "Vente 2026",
  description: "Vente au profit de l'Ensemble de Cuivres Mélodia.",
};

function wineRow(overrides: Partial<CampaignProductRow> = {}): CampaignProductRow {
  return {
    productId: "product-1",
    productActive: true,
    productSlug: "chasselas",
    productName: "Chasselas",
    productCategory: "WHITE",
    productProducer: "Domaine des Coteaux",
    productVintage: 2025,
    productRegion: "Vaud",
    productGrapeVariety: null,
    productShortDescription: null,
    productDescription: null,
    productTastingNotes: null,
    productImageUrl: null,
    campaignProductActive: true,
    unitPriceAmount: 1800,
    displayOrder: 0,
    ...overrides,
  };
}

describe("shapePublicCatalog — wines", () => {
  it("returns an empty wine list for an active campaign with nothing configured (distinct from no-active-campaign)", () => {
    const result = shapePublicCatalog(campaign, [], []);
    expect(result).toEqual({ state: "active", campaign, wines: [], bundles: [] });
  });

  it("supports an arbitrary product count — not hardcoded to six", () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      wineRow({
        productId: `p${i}`,
        productSlug: `wine-${i}`,
        productName: `Wine ${i}`,
        displayOrder: i,
      }),
    );
    const three = shapePublicCatalog(campaign, rows, []);
    expect(three.state).toBe("active");
    if (three.state === "active") expect(three.wines).toHaveLength(3);

    const tenRows = Array.from({ length: 10 }, (_, i) =>
      wineRow({
        productId: `p${i}`,
        productSlug: `wine-${i}`,
        productName: `Wine ${i}`,
        displayOrder: i,
      }),
    );
    const ten = shapePublicCatalog(campaign, tenRows, []);
    expect(ten.state).toBe("active");
    if (ten.state === "active") expect(ten.wines).toHaveLength(10);
  });

  it("orders wines by displayOrder ascending, with a deterministic name tiebreak", () => {
    const rows = [
      wineRow({ productId: "p3", productName: "Zinfandel", displayOrder: 2 }),
      wineRow({ productId: "p1", productName: "Merlot", displayOrder: 0 }),
      wineRow({ productId: "p2b", productName: "Gamay", displayOrder: 1 }),
      wineRow({ productId: "p2a", productName: "Chasselas", displayOrder: 1 }),
    ];
    const result = shapePublicCatalog(campaign, rows, []);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.wines.map((w) => w.name)).toEqual(["Merlot", "Chasselas", "Gamay", "Zinfandel"]);
  });

  it("uses the campaign-specific price, not any other value", () => {
    const rows = [wineRow({ unitPriceAmount: 2450 })];
    const result = shapePublicCatalog(campaign, rows, []);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.wines[0]?.price).toBe(money(2450));
  });

  it("preserves null optional metadata rather than inventing placeholder text", () => {
    const rows = [
      wineRow({
        productProducer: null,
        productVintage: null,
        productRegion: null,
        productGrapeVariety: null,
        productShortDescription: null,
        productDescription: null,
        productTastingNotes: null,
      }),
    ];
    const result = shapePublicCatalog(campaign, rows, []);
    if (result.state !== "active") throw new Error("expected active state");
    const wine = result.wines[0]!;
    expect(wine.producer).toBeNull();
    expect(wine.vintage).toBeNull();
    expect(wine.region).toBeNull();
    expect(wine.grapeVariety).toBeNull();
  });

  it("excludes a wine whose Product is globally inactive", () => {
    const rows = [wineRow({ productActive: false })];
    const result = shapePublicCatalog(campaign, rows, []);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.wines).toHaveLength(0);
  });

  it("excludes a wine whose CampaignProduct is inactive for this campaign", () => {
    const rows = [wineRow({ campaignProductActive: false })];
    const result = shapePublicCatalog(campaign, rows, []);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.wines).toHaveLength(0);
  });
});

describe("shapePublicCatalog — bundles", () => {
  const wines: CampaignProductRow[] = [
    wineRow({ productId: "p1", productName: "Chasselas", displayOrder: 2 }),
    wineRow({ productId: "p2", productName: "Pinot Noir", displayOrder: 0 }),
    wineRow({ productId: "p3", productName: "Gamaret", displayOrder: 1 }),
  ];

  function bundleRow(overrides: Partial<BundleRow> = {}): BundleRow {
    return {
      id: "bundle-1",
      slug: "carton-decouverte",
      name: "Carton découverte",
      shortDescription: "Une bouteille de chaque.",
      description: null,
      imageUrl: null,
      priceAmount: 5000,
      displayOrder: 0,
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 1 },
        { productId: "p3", quantity: 1 },
      ],
      ...overrides,
    };
  }

  it("shapes a valid bundle with explicit composition and derived bottle count", () => {
    const result = shapePublicCatalog(campaign, wines, [bundleRow()]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(1);
    const bundle = result.bundles[0]!;
    expect(bundle.price).toBe(money(5000));
    expect(bundle.bottleCount).toBe(3);
    expect(bundle.items).toHaveLength(3);
  });

  it("orders bundle composition by each component's own CampaignProduct.displayOrder, not insertion order", () => {
    const result = shapePublicCatalog(campaign, wines, [bundleRow()]);
    if (result.state !== "active") throw new Error("expected active state");
    // wines displayOrder: Pinot Noir=0, Gamaret=1, Chasselas=2
    expect(result.bundles[0]?.items.map((i) => i.name)).toEqual([
      "Pinot Noir",
      "Gamaret",
      "Chasselas",
    ]);
  });

  it("excludes the whole bundle when any component references a product outside the active campaign's visible wines", () => {
    const badBundle = bundleRow({
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "does-not-exist", quantity: 1 },
      ],
    });
    const result = shapePublicCatalog(campaign, wines, [badBundle]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(0);
  });

  it("excludes the whole bundle when a component's product is present but inactive in this campaign", () => {
    const winesWithOneInactive = [
      wineRow({ productId: "p1", productName: "Chasselas", displayOrder: 0 }),
      wineRow({
        productId: "p2",
        productName: "Pinot Noir",
        displayOrder: 1,
        campaignProductActive: false,
      }),
    ];
    const bundle = bundleRow({
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 1 },
      ],
    });
    const result = shapePublicCatalog(campaign, winesWithOneInactive, [bundle]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(0);
  });

  it("excludes a bundle with no items at all rather than showing an empty composition", () => {
    const result = shapePublicCatalog(campaign, wines, [bundleRow({ items: [] })]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(0);
  });

  it("does not assume exactly one bundle — supports zero, one, or several valid bundles independently", () => {
    const second = bundleRow({
      id: "bundle-2",
      slug: "second-bundle",
      name: "Second Bundle",
      displayOrder: 1,
    });
    const result = shapePublicCatalog(campaign, wines, [bundleRow(), second]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(2);
  });

  it("never shows a partially-valid bundle — one bad component excludes the entire bundle, not just that item", () => {
    const bundle = bundleRow({
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 2 },
        { productId: "missing", quantity: 1 },
      ],
    });
    const result = shapePublicCatalog(campaign, wines, [bundle]);
    if (result.state !== "active") throw new Error("expected active state");
    expect(result.bundles).toHaveLength(0);
  });
});
