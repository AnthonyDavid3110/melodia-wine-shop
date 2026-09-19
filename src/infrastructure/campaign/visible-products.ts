import { and, eq } from "drizzle-orm";
import { db } from "../database/client";
import { campaignProducts, products } from "../database/schema";

type DbHandle = Pick<typeof db, "select">;

/**
 * The set of product ids publicly visible in a campaign right now
 * (`CampaignProduct.active AND Product.active` — the same Gate 1/2 rule
 * `shape-public-catalog.ts` enforces). Shared by the admin readiness
 * check and the admin bundle list/editor so "is this bundle currently
 * valid" is computed from one definition of visibility everywhere, not
 * reimplemented per call site.
 */
export async function getVisibleProductIds(
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<Set<string>> {
  const rows = await dbHandle
    .select({ productId: campaignProducts.productId })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(
      and(
        eq(campaignProducts.campaignId, campaignId),
        eq(campaignProducts.active, true),
        eq(products.active, true),
      ),
    );
  return new Set(rows.map((row) => row.productId));
}
