/**
 * `Product.category` is deliberately plain text, not a Postgres enum
 * (docs/04-DATA-MODEL.md §6 — "should not unnecessarily prevent
 * additional categories later"), so this is a presentation-only,
 * best-effort French label. An unrecognized future category still
 * displays (falls back to the raw value) rather than disappearing or
 * crashing — the public UI is French-only (docs/07-DESIGN-SYSTEM.md
 * §52), so this belongs at the UI boundary, not in the domain layer,
 * which stays language-agnostic.
 */
const CATEGORY_LABELS: Record<string, string> = {
  WHITE: "Blanc",
  RED: "Rouge",
  ROSE: "Rosé",
};

export function wineCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
