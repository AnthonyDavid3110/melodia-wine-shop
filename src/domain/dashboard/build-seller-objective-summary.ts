export interface SellerObjectiveRow {
  sellerId: string | null;
  sellerName: string | null;
  /** `null` for the unassigned pseudo-row, or a seller with no target set. */
  target: number | null;
  progressPercentage: number | null;
}

export interface SellerObjectiveSummary {
  reachedCount: number;
  /** Sellers who have a real (non-zero) target set — the denominator "which sellers reached their objective?" applies to. */
  totalWithTargetCount: number;
  reachedSellers: { sellerId: string; sellerName: string; percentage: number }[];
}

/**
 * Compact answer to "Which sellers reached their objective?"
 * (docs/06-ADMIN-SPEC.md §4) from `listCampaignSellerSalesSummaries()`
 * rows — deliberately NOT the full Gate 13C seller-statistics table,
 * just a count and short list. Excludes the synthetic unassigned
 * pseudo-row (`sellerId: null`) and any seller with no real target set
 * (`calculateSellerProgress()`'s zero-target rule always yields 0%,
 * which isn't a meaningful "objective" to reach or miss).
 */
export function buildSellerObjectiveSummary(
  rows: readonly SellerObjectiveRow[],
): SellerObjectiveSummary {
  const withTarget = rows.filter(
    (row): row is SellerObjectiveRow & { sellerId: string; sellerName: string; target: number } =>
      row.sellerId !== null && row.sellerName !== null && row.target !== null && row.target > 0,
  );
  const reached = withTarget.filter((row) => (row.progressPercentage ?? 0) >= 100);

  return {
    reachedCount: reached.length,
    totalWithTargetCount: withTarget.length,
    reachedSellers: reached.map((row) => ({
      sellerId: row.sellerId,
      sellerName: row.sellerName,
      percentage: row.progressPercentage ?? 0,
    })),
  };
}
