/**
 * Thrown when more than one ACTIVE campaign is found — an invariant
 * violation, not a business state (Phase 4 Gate 2). PostgreSQL now
 * enforces "at most one ACTIVE campaign" via the
 * `campaigns_one_active_idx` partial unique index (drizzle/0002), so
 * this should be unreachable in production; this function still
 * defends against it explicitly rather than silently picking one —
 * exactly the behaviour Gate 2 requires ("must NOT silently select a
 * campaign"). Callers let this propagate to the Next.js error
 * boundary, not to a "no active sale" business state.
 */
export class MultipleActiveCampaignsError extends Error {
  constructor(count: number) {
    super(`Invariant violation: expected at most one ACTIVE campaign, found ${count}.`);
    this.name = "MultipleActiveCampaignsError";
  }
}

/**
 * Resolves "the" active campaign from the set of campaigns already
 * queried with `status = 'ACTIVE'`. Generic over the row shape so it
 * has no coupling to any specific campaign type — it only validates
 * arity and passes the row through.
 */
export function resolveActiveCampaign<T>(activeCampaigns: readonly T[]): T | null {
  if (activeCampaigns.length === 0) {
    return null;
  }
  if (activeCampaigns.length > 1) {
    throw new MultipleActiveCampaignsError(activeCampaigns.length);
  }
  return activeCampaigns[0]!;
}
