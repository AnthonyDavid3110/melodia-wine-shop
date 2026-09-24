import { describe, expect, it } from "vitest";
import { formatCsvDate, formatCsvDateTime } from "./format-csv-date";

describe("formatCsvDate", () => {
  it("formats a UTC instant in Europe/Zurich winter time (CET, UTC+1)", () => {
    expect(formatCsvDate(new Date("2026-01-15T10:30:00Z"))).toBe("2026-01-15");
  });

  it("formats a UTC instant in Europe/Zurich summer time (CEST, UTC+2)", () => {
    expect(formatCsvDate(new Date("2026-07-15T10:30:00Z"))).toBe("2026-07-15");
  });

  it("rolls over to the next local day when the UTC instant is late enough", () => {
    // 23:30 UTC in January is 00:30 the next day in Zurich (CET, UTC+1).
    expect(formatCsvDate(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCsvDate(null)).toBe("");
    expect(formatCsvDate(undefined)).toBe("");
  });
});

describe("formatCsvDateTime", () => {
  it("formats a UTC instant in Europe/Zurich winter time with a 24h clock", () => {
    expect(formatCsvDateTime(new Date("2026-01-15T10:30:00Z"))).toBe("2026-01-15 11:30");
  });

  it("formats a UTC instant in Europe/Zurich summer time with a 24h clock", () => {
    expect(formatCsvDateTime(new Date("2026-07-15T10:30:00Z"))).toBe("2026-07-15 12:30");
  });

  it("normalizes local midnight to 00:00, never 24:00", () => {
    // 23:00 UTC in January is exactly 00:00 the next day in Zurich (CET, UTC+1).
    const result = formatCsvDateTime(new Date("2026-01-14T23:00:00Z"));
    expect(result).toBe("2026-01-15 00:00");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCsvDateTime(null)).toBe("");
    expect(formatCsvDateTime(undefined)).toBe("");
  });
});
