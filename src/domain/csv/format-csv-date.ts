/**
 * Deterministic Europe/Zurich date/datetime formatting for CSV cells
 * (Phase 12 Gate 12A). Uses `Intl.DateTimeFormat.formatToParts()`
 * rather than `toLocaleString()`'s assembled string, which is not a
 * stable/testable format across locales and Node ICU builds (e.g.
 * "en-CA" can glue date/time with a comma or narrow no-break space
 * depending on version) — assembling from parts keeps the exact
 * "YYYY-MM-DD" / "YYYY-MM-DD HH:mm" shape guaranteed regardless.
 */

const ZURICH_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ZURICH_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function partsToMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return map;
}

/** ISO `YYYY-MM-DD`, resolved in Europe/Zurich local time. */
export function formatCsvDate(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }
  const parts = partsToMap(ZURICH_DATE_FORMATTER.formatToParts(date));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** `YYYY-MM-DD HH:mm`, resolved in Europe/Zurich local time, 24h clock. */
export function formatCsvDateTime(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }
  const parts = partsToMap(ZURICH_DATETIME_FORMATTER.formatToParts(date));
  // Some ICU builds render midnight as "24" with hour12:false — normalize to "00".
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}
