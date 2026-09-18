/**
 * Joins optional metadata fragments with " · ", silently dropping any
 * that are null/empty rather than rendering an empty label or a
 * dangling separator (Gate 2: "do not force empty metadata labels when
 * optional data is null"). Returns null when nothing is left to show,
 * so callers can skip rendering the line entirely.
 */
export function formatMetadataLine(parts: ReadonlyArray<string | number | null>): string | null {
  const filtered = parts.filter((part): part is string | number => part !== null && part !== "");
  return filtered.length > 0 ? filtered.join(" · ") : null;
}
