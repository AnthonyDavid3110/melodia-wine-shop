import { describe, expect, it } from "vitest";
import { money } from "../money";
import { calculateSellerProgress } from "./calculate-seller-progress";

describe("calculateSellerProgress", () => {
  it("computes a partial percentage (docs/03-USER-FLOWS.md §34 example)", () => {
    const progress = calculateSellerProgress(money(78_000), money(100_000));
    expect(progress).toEqual({ amount: 78_000, target: 100_000, percentage: 78 });
  });

  it("computes over-100% once the target is exceeded", () => {
    const progress = calculateSellerProgress(money(142_000), money(100_000));
    expect(progress.percentage).toBe(142);
  });

  it("returns 0% for zero sales", () => {
    expect(calculateSellerProgress(money(0), money(100_000)).percentage).toBe(0);
  });

  it("does not divide by zero when the target is zero", () => {
    const progress = calculateSellerProgress(money(500), money(0));
    expect(progress.percentage).toBe(0);
    expect(Number.isFinite(progress.percentage)).toBe(true);
  });

  it("rounds to the nearest whole percentage", () => {
    expect(calculateSellerProgress(money(1), money(3)).percentage).toBe(33);
  });
});
