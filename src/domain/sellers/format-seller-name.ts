/**
 * Human display order for a Seller's name (Phase 5 Gate 2C §9) —
 * "Anne Bornand", never "Bornand Anne". Sorting stays lastName-first
 * (`listSellers`/`listCampaignSellers` `ORDER BY`) — this only affects
 * how a name is displayed, never the stored `firstName`/`lastName`
 * fields or how lists are ordered.
 */
export function formatSellerName(seller: { firstName: string; lastName: string }): string {
  return `${seller.firstName} ${seller.lastName}`;
}
