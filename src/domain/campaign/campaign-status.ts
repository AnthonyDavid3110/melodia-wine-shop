/**
 * Campaign lifecycle state machine (Phase 5 Gate 1, approved). Status
 * is never a free-editable field — every transition must go through
 * `isValidCampaignTransition` server-side, and only these four
 * transitions exist in V1:
 *
 *   DRAFT   -> ACTIVE   (ACTIVATED)
 *   DRAFT   -> ARCHIVED (ARCHIVED — "abandon before ever launching")
 *   ACTIVE  -> CLOSED   (CLOSED)
 *   CLOSED  -> ACTIVE   (REOPENED)
 *   CLOSED  -> ARCHIVED (ARCHIVED)
 *   ARCHIVED is terminal — no transition out, by approved decision.
 *
 * The database's `campaigns_one_active_idx` partial unique index
 * remains the final backstop against two simultaneously ACTIVE
 * campaigns; this module is the first line of defence (a clear
 * "invalid transition" error) and the source of the event-type
 * classification recorded in `campaignEvents`.
 */
export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";

export type CampaignEventType = "ACTIVATED" | "CLOSED" | "REOPENED" | "ARCHIVED";

const ALLOWED_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["CLOSED"],
  CLOSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function isValidCampaignTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Maps an (already-validated) transition to the `campaignEvents.type`
 * value to record. Throws for an invalid transition rather than
 * guessing — callers must check `isValidCampaignTransition` first.
 */
export function campaignEventTypeForTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): CampaignEventType {
  if (!isValidCampaignTransition(from, to)) {
    throw new Error(`Invalid campaign transition: ${from} -> ${to}`);
  }
  if (to === "ACTIVE") {
    return from === "CLOSED" ? "REOPENED" : "ACTIVATED";
  }
  if (to === "CLOSED") {
    return "CLOSED";
  }
  return "ARCHIVED";
}
