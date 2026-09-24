import {
  listFulfilmentRelevantCampaigns,
  resolveDefaultFulfilmentCampaign,
} from "@/infrastructure/campaign/campaigns";

/**
 * Shared campaign resolution for `/admin/exports` (the page and every
 * download Route Handler) — the exact same pattern already established
 * by `/admin/preparation` (Phase 12 Gate 12A approved Step 1 §7), never
 * a second campaign-selection mechanism. A requested id is only ever
 * used to look itself up in the authoritative ACTIVE/CLOSED list —
 * never trusted directly as a valid campaign.
 */
export async function resolveExportCampaign(requestedCampaignId: string | null) {
  const relevantCampaigns = await listFulfilmentRelevantCampaigns();
  const requested = requestedCampaignId
    ? relevantCampaigns.find((candidate) => candidate.id === requestedCampaignId)
    : undefined;
  const campaign = requested ?? (await resolveDefaultFulfilmentCampaign());
  return { campaign, relevantCampaigns };
}
