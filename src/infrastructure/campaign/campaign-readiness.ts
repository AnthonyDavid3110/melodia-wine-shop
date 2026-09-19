import { and, eq, ne } from "drizzle-orm";
import { isBundleValid, type BundleRow } from "@/domain/catalog/shape-public-catalog";
import type { CampaignReadinessFacts } from "@/domain/campaign/campaign-readiness";
import { db } from "../database/client";
import {
  bundleItems,
  bundles,
  campaignProducts,
  campaignSellers,
  campaigns,
  products,
} from "../database/schema";

type DbHandle = Pick<typeof db, "select">;

/**
 * Gathers the real facts `checkCampaignReadiness` classifies (Phase 5
 * Gate 2A). CampaignProduct/Bundle/CampaignSeller admin UIs don't
 * exist yet (Gate 2B+), so for a Gate 2A-created campaign these mostly
 * come back as honest zeros — not stubbed, genuinely queried, so this
 * becomes correct automatically once those admin surfaces exist,
 * without needing to revisit this function.
 */
export async function getCampaignReadinessFacts(
  campaign: {
    id: string;
    publicTitle: string | null;
    openingDate: Date | null;
    closingDate: Date | null;
  },
  dbHandle: DbHandle = db,
): Promise<CampaignReadinessFacts> {
  const [conflicting] = await dbHandle
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, "ACTIVE"), ne(campaigns.id, campaign.id)));

  const campaignProductRows = await dbHandle
    .select({
      productId: campaignProducts.productId,
      unitPriceAmount: campaignProducts.unitPriceAmount,
      campaignProductActive: campaignProducts.active,
      productActive: products.active,
    })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, campaign.id));

  const visibleRows = campaignProductRows.filter(
    (row) => row.campaignProductActive && row.productActive,
  );
  const visibleProductIds = new Set(visibleRows.map((row) => row.productId));

  const bundleRows = await dbHandle
    .select({ bundle: bundles, item: bundleItems })
    .from(bundles)
    .leftJoin(bundleItems, eq(bundleItems.bundleId, bundles.id))
    .where(and(eq(bundles.campaignId, campaign.id), eq(bundles.active, true)));

  const bundlesById = new Map<string, BundleRow>();
  for (const { bundle, item } of bundleRows) {
    let entry = bundlesById.get(bundle.id);
    if (!entry) {
      entry = {
        id: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        shortDescription: bundle.shortDescription,
        description: bundle.description,
        imageUrl: bundle.imageUrl,
        priceAmount: bundle.priceAmount,
        displayOrder: bundle.displayOrder,
        items: [],
      };
      bundlesById.set(bundle.id, entry);
    }
    if (item) {
      (entry.items as { productId: string; quantity: number }[]).push({
        productId: item.productId,
        quantity: item.quantity,
      });
    }
  }
  const brokenActiveBundleCount = Array.from(bundlesById.values()).filter(
    (bundle) => !isBundleValid(bundle, visibleProductIds),
  ).length;

  const activeSellerRows = await dbHandle
    .select({ id: campaignSellers.id })
    .from(campaignSellers)
    .where(and(eq(campaignSellers.campaignId, campaign.id), eq(campaignSellers.active, true)));

  return {
    anotherActiveCampaignExists: Boolean(conflicting),
    publicTitle: campaign.publicTitle,
    visibleProductCount: visibleRows.length,
    zeroPricedVisibleProductCount: visibleRows.filter((row) => row.unitPriceAmount === 0).length,
    brokenActiveBundleCount,
    activeSellerCount: activeSellerRows.length,
    hasAnyDate: Boolean(campaign.openingDate || campaign.closingDate),
  };
}
