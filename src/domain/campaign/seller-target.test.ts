import { describe, expect, it } from "vitest";
import { effectiveSellerTarget } from "./seller-target";

describe("effectiveSellerTarget", () => {
  it("falls back to the campaign default when there is no override", () => {
    expect(effectiveSellerTarget(null, 100_000)).toBe(100_000);
  });

  it("uses the override when present", () => {
    expect(effectiveSellerTarget(120_000, 100_000)).toBe(120_000);
  });

  it("returns null when neither an override nor a default exists", () => {
    expect(effectiveSellerTarget(null, null)).toBeNull();
  });

  it("a zero override is a valid explicit target, not 'empty' — never falls back", () => {
    expect(effectiveSellerTarget(0, 100_000)).toBe(0);
  });

  it("a zero campaign default is used when there is no override", () => {
    expect(effectiveSellerTarget(null, 0)).toBe(0);
  });
});
