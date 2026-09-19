"use client";

import { useEffect } from "react";
import { useCart } from "./cart-context";

/**
 * Campaign reconciliation (Phase 6 Gate 1 architecture correction).
 * Renders nothing — its only job is comparing the hydrated cart's
 * stored `campaignId` against the authoritative one a Server Component
 * page already fetched (`/` or `/panier`, both call `getPublicCatalog`
 * anyway), and discarding the cart if they differ. A stale cart from
 * campaign A can never silently carry into campaign B's ids.
 *
 * Waits for `hydrated` before comparing: comparing against the
 * pre-hydration placeholder cart (`campaignId: ""`) would incorrectly
 * "reset" a real stored cart before it had even been read.
 */
export function CartCampaignSync({ campaignId }: { campaignId: string }) {
  const { cart, hydrated, resetForCampaign } = useCart();

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (cart.campaignId !== campaignId) {
      resetForCampaign(campaignId);
    }
  }, [hydrated, cart.campaignId, campaignId, resetForCampaign]);

  return null;
}
