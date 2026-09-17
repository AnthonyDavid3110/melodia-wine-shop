import { describe, expect, it } from "vitest";
import { money } from "../money";
import { calculateOrderTotal } from "./calculate-order-total";

describe("calculateOrderTotal", () => {
  it("returns zero for an empty cart", () => {
    const result = calculateOrderTotal([]);
    expect(result.total).toBe(0);
    expect(result.lineTotals).toEqual([]);
  });

  it("computes a single line total", () => {
    const result = calculateOrderTotal([{ unitPriceAmount: money(1800), quantity: 3 }]);
    expect(result.lineTotals).toEqual([5400]);
    expect(result.total).toBe(5400);
  });

  it("sums multiple lines, mixing products and bundles (BR-CART-001)", () => {
    const result = calculateOrderTotal([
      { unitPriceAmount: money(1800), quantity: 2 }, // 3600 — individual bottles
      { unitPriceAmount: money(12_000), quantity: 1 }, // 12000 — a bundle
    ]);
    expect(result.lineTotals).toEqual([3600, 12_000]);
    expect(result.total).toBe(15_600);
  });

  it("handles a single-bottle order (BR-PRO-004 — no minimum order)", () => {
    const result = calculateOrderTotal([{ unitPriceAmount: money(1800), quantity: 1 }]);
    expect(result.total).toBe(1800);
  });
});
