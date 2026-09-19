import { describe, expect, it } from "vitest";
import { formatDateInputFr, parseDateInputFr } from "./date-input";

describe("formatDateInputFr", () => {
  it("formats a date as dd.mm.yyyy", () => {
    expect(formatDateInputFr(new Date(Date.UTC(2026, 5, 3)))).toBe("03.06.2026");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatDateInputFr(null)).toBe("");
    expect(formatDateInputFr(undefined)).toBe("");
  });
});

describe("parseDateInputFr", () => {
  it("parses a valid dd.mm.yyyy date", () => {
    const result = parseDateInputFr("03.06.2026");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.toISOString()).toBe(new Date(Date.UTC(2026, 5, 3)).toISOString());
    }
  });

  it("treats empty input as valid null (dates are optional)", () => {
    const result = parseDateInputFr("   ");
    expect(result).toEqual({ ok: true, value: null });
  });

  it("rejects a malformed string", () => {
    const result = parseDateInputFr("2026-06-03");
    expect(result.ok).toBe(false);
  });

  it("rejects a calendar-impossible date instead of silently rolling it over", () => {
    const result = parseDateInputFr("31.02.2026");
    expect(result.ok).toBe(false);
  });

  it("round-trips through formatDateInputFr", () => {
    const parsed = parseDateInputFr("25.12.2026");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(formatDateInputFr(parsed.value)).toBe("25.12.2026");
    }
  });
});
