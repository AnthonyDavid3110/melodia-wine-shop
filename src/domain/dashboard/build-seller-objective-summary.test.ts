import { describe, expect, it } from "vitest";
import {
  buildSellerObjectiveSummary,
  type SellerObjectiveRow,
} from "./build-seller-objective-summary";

describe("buildSellerObjectiveSummary", () => {
  it("counts sellers who reached 100% or more of their target", () => {
    const rows: SellerObjectiveRow[] = [
      { sellerId: "s1", sellerName: "Anthony David", target: 50_000, progressPercentage: 120 },
      { sellerId: "s2", sellerName: "Marie Martin", target: 50_000, progressPercentage: 100 },
      { sellerId: "s3", sellerName: "Jean Dupont", target: 50_000, progressPercentage: 40 },
    ];
    const summary = buildSellerObjectiveSummary(rows);
    expect(summary.reachedCount).toBe(2);
    expect(summary.totalWithTargetCount).toBe(3);
    expect(summary.reachedSellers.map((s) => s.sellerName)).toEqual([
      "Anthony David",
      "Marie Martin",
    ]);
  });

  it("excludes the unassigned pseudo-row", () => {
    const rows: SellerObjectiveRow[] = [
      { sellerId: null, sellerName: null, target: null, progressPercentage: null },
      { sellerId: "s1", sellerName: "Anthony David", target: 50_000, progressPercentage: 100 },
    ];
    const summary = buildSellerObjectiveSummary(rows);
    expect(summary.totalWithTargetCount).toBe(1);
    expect(summary.reachedCount).toBe(1);
  });

  it("excludes sellers with no real target set", () => {
    const rows: SellerObjectiveRow[] = [
      { sellerId: "s1", sellerName: "Anthony David", target: 0, progressPercentage: 0 },
      { sellerId: "s2", sellerName: "Marie Martin", target: null, progressPercentage: null },
    ];
    const summary = buildSellerObjectiveSummary(rows);
    expect(summary.totalWithTargetCount).toBe(0);
    expect(summary.reachedCount).toBe(0);
  });

  it("returns all zeros/empty for no sellers", () => {
    expect(buildSellerObjectiveSummary([])).toEqual({
      reachedCount: 0,
      totalWithTargetCount: 0,
      reachedSellers: [],
    });
  });
});
