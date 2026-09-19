/**
 * French/Swiss date display (Phase 5 Gate 2C §7). Plain `dd.mm.yyyy`
 * text field, not `<input type="date">` — native date inputs render
 * their displayed digit order (mm/dd/yyyy vs dd.mm.yyyy) following the
 * browser/OS locale, not the page's `lang="fr"` attribute, and that is
 * not reliably overridable without fragile per-browser CSS/JS (the
 * exact trade-off documented in the Gate 2C report). A plain text field
 * guarantees the same, correct dd.mm.yyyy presentation for every admin
 * regardless of browser locale, at the cost of losing the native
 * calendar popup — acceptable here since both dates are optional and
 * informational only (`04-DATA-MODEL.md` §5, "never automatically gate
 * the public catalogue").
 *
 * Kept out of both the (server) pages' and the (client) form's own
 * "use client" boundary so either can import it directly.
 */
export function formatDateInputFr(date: Date | null | undefined): string {
  if (!date) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export type ParsedDateInputFr = { ok: true; value: Date | null } | { ok: false; error: string };

const DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const INVALID_DATE_ERROR = "Date invalide — utilisez le format jj.mm.aaaa.";

/** Empty input is valid (both dates are optional) and parses to `null`. */
export function parseDateInputFr(input: string): ParsedDateInputFr {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const match = DATE_PATTERN.exec(trimmed);
  if (!match) {
    return { ok: false, error: INVALID_DATE_ERROR };
  }

  const [, ddStr, mmStr, yyyyStr] = match;
  const day = Number(ddStr);
  const month = Number(mmStr);
  const year = Number(yyyyStr);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Rejects calendar-impossible input (e.g. 31.02.2026) that Date would
  // otherwise silently roll over into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: INVALID_DATE_ERROR };
  }

  return { ok: true, value: date };
}
