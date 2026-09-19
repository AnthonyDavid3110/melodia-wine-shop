/**
 * Seller-target inheritance rule (Phase 5 Gate 1/2B, approved):
 * `CampaignSeller.targetAmount ?? Campaign.defaultSellerTargetAmount`.
 * `??` is deliberate, not `||` — a `0` override is a valid, explicit
 * target and must never be treated as "empty" and fall back to the
 * campaign default; only `null` (never configured) does.
 */
export function effectiveSellerTarget(
  overrideAmount: number | null,
  campaignDefaultAmount: number | null,
): number | null {
  return overrideAmount ?? campaignDefaultAmount;
}
