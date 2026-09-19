/**
 * Slug generation for admin-created Products/Campaigns/Bundles (Phase 5
 * Gate 2A/2C). Since Gate 2C, this is the *only* way a slug is ever
 * produced — there is no admin-facing slug field to edit or confirm
 * (Gate 2C §6: normal administrators should never need to understand
 * URL identifiers). Explicit ligature mapping (œ/æ) before generic
 * accent-stripping so "Œil-de-Perdrix" produces "oeil-de-perdrix",
 * matching the existing hand-written seed slug, rather than dropping
 * the character entirely.
 */
const LIGATURES: Record<string, string> = { œ: "oe", Œ: "OE", æ: "ae", Æ: "AE" };
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  const withoutLigatures = input.replace(/[œŒæÆ]/g, (ch) => LIGATURES[ch] ?? ch);

  return withoutLigatures
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates a slug from `name` and appends `-2`, `-3`, ... until
 * `isTaken` reports a free candidate (Gate 2C §6) — the DB's own unique
 * constraint remains the authoritative backstop against a genuine race
 * (two simultaneous creates with the same name); this just makes the
 * common case not require the admin to notice or fix a collision.
 * `isTaken` is caller-supplied so this stays DB-free and unit-testable;
 * infrastructure call sites pass a real existence query.
 */
export async function generateUniqueSlug(
  name: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const base = slugify(name);
  if (!(await isTaken(base))) {
    return base;
  }
  for (let n = 2; n <= maxAttempts; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error(`generateUniqueSlug: exhausted ${maxAttempts} attempts for base "${base}".`);
}
