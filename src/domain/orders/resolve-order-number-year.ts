/**
 * Which calendar year an order number's `ECM-YYYY-NNNN` prefix should
 * use (Phase 7 §7). `campaigns` has no dedicated "year" field
 * (docs/04-DATA-MODEL.md §5) — `openingDate` is the closest authoritative
 * source (the actual real-world year the sale runs), but it is nullable:
 * Phase 5's readiness check (`campaign-readiness.ts`) only ever warns
 * ("informational", never "blocking") when no date is set, so a real
 * ACTIVE campaign with `openingDate = null` is a state the schema
 * genuinely allows. `campaign.createdAt` is deliberately NOT used as the
 * fallback — a campaign can be created in DRAFT long before the sale it
 * describes actually opens, so its row-creation timestamp has no
 * reliable relationship to the sale year. The current wall-clock year is
 * the better fallback: orders can only ever be created while a campaign
 * is ACTIVE (BR-CAM-002), so "now" during a live sale is a much closer
 * proxy for the intended sale year than an unrelated row-creation date.
 */
export function resolveOrderNumberYear(
  campaign: { openingDate: Date | null },
  now: Date = new Date(),
): number {
  return (campaign.openingDate ?? now).getFullYear();
}
