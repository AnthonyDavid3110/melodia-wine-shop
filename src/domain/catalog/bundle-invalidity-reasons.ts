/**
 * Admin-facing diagnostic for WHY a bundle is currently invalid
 * (CORR-001) — a companion to `shape-public-catalog.ts`'s
 * `isBundleValid()`, never a replacement for it. That function stays
 * the single source of truth for the pass/fail boolean (catalogue
 * rendering, public visibility); this module only explains a `false`
 * result to an admin, item by item, reusing the exact same visibility
 * rule it enforces — reusing the existing business rule, never
 * loosening it.
 */

export type BundleInvalidityReasonCode =
  "empty-composition" | "not-attached-to-campaign" | "inactive-in-campaign" | "product-inactive";

export interface BundleInvalidityReason {
  productId: string;
  productName: string;
  code: BundleInvalidityReasonCode;
  message: string;
}

export interface BundleCompositionItem {
  productId: string;
  productName: string;
  /** The product's own master-data active flag (`products.active`). */
  productActive: boolean;
}

export interface CampaignProductVisibility {
  productId: string;
  /** `campaign_products.active` for this specific campaign. */
  active: boolean;
}

/**
 * Diagnoses every composition item that currently keeps a bundle out
 * of the public catalogue — reusing exactly the two conditions
 * `isBundleValid()` checks (non-empty composition; every item's
 * product attached-and-active for this campaign AND active at the
 * product level), but naming which item and which of those conditions
 * failed, instead of only reporting a single yes/no.
 */
export function diagnoseBundleInvalidity(
  items: readonly BundleCompositionItem[],
  campaignProducts: readonly CampaignProductVisibility[],
): BundleInvalidityReason[] {
  if (items.length === 0) {
    return [
      {
        productId: "",
        productName: "",
        code: "empty-composition",
        message: "Ce carton ne contient aucun vin.",
      },
    ];
  }

  const campaignProductByProductId = new Map(campaignProducts.map((row) => [row.productId, row]));

  const reasons: BundleInvalidityReason[] = [];
  for (const item of items) {
    const campaignProduct = campaignProductByProductId.get(item.productId);
    if (!campaignProduct) {
      reasons.push({
        productId: item.productId,
        productName: item.productName,
        code: "not-attached-to-campaign",
        message: `« ${item.productName} » n'est plus attaché à cette campagne.`,
      });
      continue;
    }
    if (!campaignProduct.active) {
      reasons.push({
        productId: item.productId,
        productName: item.productName,
        code: "inactive-in-campaign",
        message: `« ${item.productName} » a été désactivé pour cette campagne.`,
      });
      continue;
    }
    if (!item.productActive) {
      reasons.push({
        productId: item.productId,
        productName: item.productName,
        code: "product-inactive",
        message: `« ${item.productName} » a été désactivé (fiche produit).`,
      });
    }
  }
  return reasons;
}
