/**
 * Deterministic, safe, human-readable filename fragment from a display
 * name (Phase 12 Gate 12B) — lowercase, diacritics stripped, unsafe
 * characters collapsed to hyphens, never a UUID or arbitrary path
 * character. Used for the seller preparation PDF filename; the seller
 * is always identified server-side by id in the URL, so a duplicate
 * slug across two sellers is cosmetically ambiguous but never a
 * correctness/security issue.
 */
export function slugifyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
