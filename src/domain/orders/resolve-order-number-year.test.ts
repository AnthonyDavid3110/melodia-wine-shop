import { describe, expect, it } from "vitest";
import { resolveOrderNumberYear } from "./resolve-order-number-year";

describe("resolveOrderNumberYear", () => {
  it("uses the campaign's openingDate year when set", () => {
    const year = resolveOrderNumberYear(
      { openingDate: new Date("2026-09-15T00:00:00Z") },
      new Date("2099-01-01T00:00:00Z"),
    );
    expect(year).toBe(2026);
  });

  it("falls back to the current wall-clock year when openingDate is null — never createdAt", () => {
    const year = resolveOrderNumberYear({ openingDate: null }, new Date("2027-03-01T00:00:00Z"));
    expect(year).toBe(2027);
  });
});
