import { money } from "../money";
import type {
  PublicBundle,
  PublicBundleItem,
  PublicCampaign,
  PublicCatalog,
  PublicWine,
} from "./public-catalog";

/**
 * One (CampaignProduct × Product) join row, already scoped to a single
 * campaign by the infrastructure query. Flat fields, not nested —
 * matches the existing domain-layer `*Input` convention (see
 * src/domain/sellers/calculate-seller-sales.ts) so this file has no
 * dependency on Drizzle's row types and every test below is a plain
 * object literal.
 */
export interface CampaignProductRow {
  productId: string;
  productActive: boolean;
  productSlug: string;
  productName: string;
  productCategory: string;
  productProducer: string | null;
  productVintage: number | null;
  productRegion: string | null;
  productGrapeVariety: string | null;
  productShortDescription: string | null;
  productDescription: string | null;
  productTastingNotes: string | null;
  productImageUrl: string | null;
  campaignProductActive: boolean;
  unitPriceAmount: number;
  displayOrder: number;
}

export interface BundleItemRow {
  productId: string;
  quantity: number;
}

export interface BundleRow {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number;
  displayOrder: number;
  items: readonly BundleItemRow[];
}

/**
 * Builds the public wine list: filters to rows that are visible per
 * the Gate 1/2 rule (`products.active AND campaignProducts.active` —
 * the SQL query already filters this, this re-asserts it so the rule
 * is correct and testable independent of the query), then orders by
 * `displayOrder ASC` with a deterministic name tiebreak.
 */
function buildWines(rows: readonly CampaignProductRow[]): PublicWine[] {
  return rows
    .filter((row) => row.productActive && row.campaignProductActive)
    .map((row): PublicWine => ({
      id: row.productId,
      slug: row.productSlug,
      name: row.productName,
      category: row.productCategory,
      producer: row.productProducer,
      vintage: row.productVintage,
      region: row.productRegion,
      grapeVariety: row.productGrapeVariety,
      shortDescription: row.productShortDescription,
      description: row.productDescription,
      tastingNotes: row.productTastingNotes,
      imageUrl: row.productImageUrl,
      price: money(row.unitPriceAmount),
      displayOrder: row.displayOrder,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

/**
 * Validates and shapes bundles against the already-resolved visible
 * wine list (Gate 2 bundle-integrity rule): every BundleItem must
 * resolve to a product that is itself visible in this same active
 * campaign. If any component fails — or the bundle has no items at
 * all, which is equally not a sellable composition — the WHOLE bundle
 * is excluded, never partially rendered. Composition order follows
 * each component's own CampaignProduct.displayOrder, reusing the
 * ordering already resolved for `wines` rather than a separate field.
 */
/**
 * The Gate 2 bundle-integrity rule, as a standalone predicate: every
 * component must resolve to a visible product id, and a bundle with no
 * items at all is equally invalid. Exported so the Phase 5 admin
 * readiness check can flag a broken active bundle using the exact same
 * rule the public catalog enforces, rather than a second
 * reimplementation that could silently drift from this one.
 */
export function isBundleValid(bundle: BundleRow, visibleProductIds: ReadonlySet<string>): boolean {
  return (
    bundle.items.length > 0 && bundle.items.every((item) => visibleProductIds.has(item.productId))
  );
}

function buildBundles(
  bundleRows: readonly BundleRow[],
  wines: readonly PublicWine[],
): PublicBundle[] {
  const wineById = new Map(wines.map((wine) => [wine.id, wine]));
  const visibleProductIds = new Set(wines.map((wine) => wine.id));

  const shaped: PublicBundle[] = [];

  for (const bundle of bundleRows) {
    if (!isBundleValid(bundle, visibleProductIds)) {
      continue;
    }

    const resolvedItems: Array<{ item: PublicBundleItem; displayOrder: number }> = [];
    for (const item of bundle.items) {
      const wine = wineById.get(item.productId)!;
      resolvedItems.push({
        item: { productId: item.productId, name: wine.name, quantity: item.quantity },
        displayOrder: wine.displayOrder,
      });
    }

    resolvedItems.sort((a, b) => a.displayOrder - b.displayOrder);
    const items = resolvedItems.map((entry) => entry.item);

    shaped.push({
      id: bundle.id,
      slug: bundle.slug,
      name: bundle.name,
      shortDescription: bundle.shortDescription,
      description: bundle.description,
      imageUrl: bundle.imageUrl,
      price: money(bundle.priceAmount),
      items,
      bottleCount: items.reduce((sum, item) => sum + item.quantity, 0),
      displayOrder: bundle.displayOrder,
    });
  }

  return shaped.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

/**
 * Shapes an already-resolved active campaign plus its campaign-scoped
 * rows into the public read model. Pure — no DB access — so every
 * business rule here (arbitrary product count, ordering, campaign
 * price, bundle integrity) is unit-testable without PostgreSQL.
 */
export function shapePublicCatalog(
  campaign: PublicCampaign,
  campaignProductRows: readonly CampaignProductRow[],
  bundleRows: readonly BundleRow[],
): PublicCatalog {
  const wines = buildWines(campaignProductRows);
  const bundles = buildBundles(bundleRows, wines);

  return { state: "active", campaign, wines, bundles };
}
