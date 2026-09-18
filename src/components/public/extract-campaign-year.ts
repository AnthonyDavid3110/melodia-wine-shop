/**
 * Best-effort extraction of a year-like token already present in the
 * campaign's own name/title text (e.g. "Les Vins de Mélodia 2026") —
 * never a fabricated or computed date. Campaign has no dedicated
 * "year" field (docs/04-DATA-MODEL.md §5), and `openingDate`/
 * `closingDate` are optional/unset for the current campaign, so this
 * is purely a decorative-display convenience: it returns null when no
 * plausible year appears, and callers must render nothing rather than
 * invent a value (Phase 4 Gate 2C hero decorative numeral).
 */
export function extractCampaignYear(text: string | null): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}
