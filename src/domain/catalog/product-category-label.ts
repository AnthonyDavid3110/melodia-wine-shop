/**
 * French display label for a Product category (Phase 5 Gate 2C §8).
 * `Product.category` deliberately stays a flexible stored string, not a
 * closed enum (Gate 1 §7/`04-DATA-MODEL.md` §6) — this only affects
 * presentation. An unrecognized value (a future category not yet in
 * this map) falls back to the raw stored value rather than breaking.
 */
const KNOWN_LABELS: Record<string, string> = {
  WHITE: "Blanc",
  RED: "Rouge",
  ROSE: "Rosé",
};

export function formatProductCategory(category: string): string {
  return KNOWN_LABELS[category] ?? category;
}
