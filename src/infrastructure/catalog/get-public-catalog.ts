import { and, eq } from "drizzle-orm";
import { resolveActiveCampaign } from "@/domain/catalog/resolve-active-campaign";
import { shapePublicCatalog, type BundleRow } from "@/domain/catalog/shape-public-catalog";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { db } from "../database/client";
import { bundleItems, bundles, campaignProducts, campaigns, products } from "../database/schema";

/**
 * The server-only public catalog query boundary (Phase 4 Gate 2). Three
 * logical queries, no N+1:
 *
 * 1. active-campaign lookup (`status = 'ACTIVE'`) — dates never gate
 *    visibility (Gate 1 decision 4), status alone is authoritative.
 *    Zero rows → the `no-active-campaign` business state. More than one
 *    row is an invariant violation (PostgreSQL's own
 *    `campaigns_one_active_idx` partial unique index — drizzle/0002 —
 *    should make this unreachable) and is left to throw via
 *    `resolveActiveCampaign`, propagating to the Next.js error
 *    boundary rather than being silently resolved.
 * 2. campaignProducts ⨝ products for that campaign, filtered at SQL
 *    level (`campaignProducts.active AND products.active`) — a single
 *    join query covering every wine, not one query per product.
 * 3. bundles ⟕ bundleItems for that campaign — a single join query
 *    covering every bundle and its items at once, grouped in JS by
 *    bundle id. Deliberately does NOT join `products` a second time:
 *    bundle-item names/ordering are resolved against the wines list
 *    already fetched in query 2 by the pure shaping function, so the
 *    same active/ordering rule is never duplicated.
 *
 * All business-rule decisions (ordering, bundle integrity, active
 * filtering as defense in depth) live in the pure, DB-free
 * `shapePublicCatalog` — this function's only job is fetching rows and
 * mapping them into that function's input shape.
 *
 * Accepts an optional query handle (defaulting to the shared `db`
 * singleton), mirroring `reserveOrderNumber`'s injectable-`tx`
 * convention — production code calls `getPublicCatalog()` with no
 * arguments; integration tests pass a `withRollback` transaction so
 * fixture rows are visible to this function without ever committing.
 */
export async function getPublicCatalog(
  dbHandle: Pick<typeof db, "select"> = db,
): Promise<PublicCatalog> {
  const activeCampaigns = await dbHandle
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "ACTIVE"));

  const campaign = resolveActiveCampaign(activeCampaigns);
  if (!campaign) {
    return { state: "no-active-campaign" };
  }

  const campaignProductRows = await dbHandle
    .select({ campaignProduct: campaignProducts, product: products })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(
      and(
        eq(campaignProducts.campaignId, campaign.id),
        eq(campaignProducts.active, true),
        eq(products.active, true),
      ),
    );

  const campaignProductInputs = campaignProductRows.map(({ campaignProduct, product }) => ({
    productId: product.id,
    productActive: product.active,
    productSlug: product.slug,
    productName: product.name,
    productCategory: product.category,
    productProducer: product.producer,
    productVintage: product.vintage,
    productRegion: product.region,
    productGrapeVariety: product.grapeVariety,
    productShortDescription: product.shortDescription,
    productDescription: product.description,
    productTastingNotes: product.tastingNotes,
    productImageUrl: product.imageUrl,
    campaignProductActive: campaignProduct.active,
    unitPriceAmount: campaignProduct.unitPriceAmount,
    displayOrder: campaignProduct.displayOrder,
  }));

  const bundleRows = await dbHandle
    .select({ bundle: bundles, item: bundleItems })
    .from(bundles)
    .leftJoin(bundleItems, eq(bundleItems.bundleId, bundles.id))
    .where(and(eq(bundles.campaignId, campaign.id), eq(bundles.active, true)));

  const bundlesById = new Map<string, (typeof bundleRows)[number]["bundle"]>();
  const itemsByBundleId = new Map<string, { productId: string; quantity: number }[]>();
  for (const { bundle, item } of bundleRows) {
    bundlesById.set(bundle.id, bundle);
    const items = itemsByBundleId.get(bundle.id) ?? [];
    if (item) {
      items.push({ productId: item.productId, quantity: item.quantity });
    }
    itemsByBundleId.set(bundle.id, items);
  }

  const bundleInputs: BundleRow[] = Array.from(bundlesById.values()).map((bundle) => ({
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    shortDescription: bundle.shortDescription,
    description: bundle.description,
    imageUrl: bundle.imageUrl,
    priceAmount: bundle.priceAmount,
    displayOrder: bundle.displayOrder,
    items: itemsByBundleId.get(bundle.id) ?? [],
  }));

  return shapePublicCatalog(
    {
      id: campaign.id,
      name: campaign.name,
      publicTitle: campaign.publicTitle,
      description: campaign.description,
    },
    campaignProductInputs,
    bundleInputs,
  );
}
