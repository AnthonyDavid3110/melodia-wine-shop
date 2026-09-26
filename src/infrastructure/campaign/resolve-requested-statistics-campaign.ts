import { listStatisticsRelevantCampaigns, resolveDefaultStatisticsCampaign } from "./campaigns";

/**
 * `/admin/statistiques`'s own campaign resolution (Phase 13 Gate 13C) —
 * mirrors `resolveRequestedCampaign()`'s exact shape, over the
 * statistics-relevant (ACTIVE ∪ CLOSED ∪ ARCHIVED) population instead
 * of the fulfilment-relevant (ACTIVE ∪ CLOSED) one. Kept as its own
 * file rather than added to `resolve-requested-campaign.ts` — the two
 * resolve genuinely different populations for genuinely different
 * pages (operational vs analytical/historical), so sharing one function
 * would require a population parameter on every caller for no benefit.
 * A requested id is only ever used to look itself up in the
 * authoritative list — never trusted directly as a valid campaign.
 */
export async function resolveRequestedStatisticsCampaign(requestedCampaignId: string | null) {
  const relevantCampaigns = await listStatisticsRelevantCampaigns();
  const requested = requestedCampaignId
    ? relevantCampaigns.find((candidate) => candidate.id === requestedCampaignId)
    : undefined;
  const campaign = requested ?? (await resolveDefaultStatisticsCampaign());
  return { campaign, relevantCampaigns };
}
