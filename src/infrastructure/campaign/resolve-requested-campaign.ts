import { listFulfilmentRelevantCampaigns, resolveDefaultFulfilmentCampaign } from "./campaigns";

/**
 * Shared campaign resolution for every admin download surface that
 * accepts an optional `?campaign=` id — `/admin/exports` (Phase 12
 * Gate 12A) and the seller preparation PDF route (Phase 12 Gate 12B),
 * moved here once a second feature needed the identical logic rather
 * than duplicating it. Matches `/admin/preparation`'s own resolution
 * pattern exactly — never a second campaign-selection mechanism. A
 * requested id is only ever used to look itself up in the
 * authoritative ACTIVE/CLOSED list — never trusted directly as a
 * valid campaign.
 */
export async function resolveRequestedCampaign(requestedCampaignId: string | null) {
  const relevantCampaigns = await listFulfilmentRelevantCampaigns();
  const requested = requestedCampaignId
    ? relevantCampaigns.find((candidate) => candidate.id === requestedCampaignId)
    : undefined;
  const campaign = requested ?? (await resolveDefaultFulfilmentCampaign());
  return { campaign, relevantCampaigns };
}
