import { describe, expect, it } from "vitest";
import { money } from "../money";
import {
  calculateSellerCollections,
  type SellerPaymentOrderInput,
} from "./calculate-seller-collections";

describe("calculateSellerCollections", () => {
  it("matches the docs/03-USER-FLOWS.md §33 worked example", () => {
    // Seller payments CHF 550.–: CHF 400 collected (of which CHF 400 still to remit), CHF 150 still to collect.
    const orders: SellerPaymentOrderInput[] = [
      { totalAmount: money(40_000), customerPaymentStatus: "PAID", settled: false },
      { totalAmount: money(15_000), customerPaymentStatus: "PENDING", settled: false },
    ];
    const summary = calculateSellerCollections(orders);
    expect(summary).toEqual({
      stillToCollect: 15_000,
      collected: 40_000,
      stillToRemit: 40_000,
    });
  });

  it("excludes settled orders from stillToRemit but keeps them in collected", () => {
    const orders: SellerPaymentOrderInput[] = [
      { totalAmount: money(12_000), customerPaymentStatus: "PAID", settled: true },
      { totalAmount: money(18_000), customerPaymentStatus: "PAID", settled: false },
    ];
    const summary = calculateSellerCollections(orders);
    expect(summary.collected).toBe(30_000);
    expect(summary.stillToRemit).toBe(18_000);
  });

  it("excludes refunded orders from every figure", () => {
    const orders: SellerPaymentOrderInput[] = [
      { totalAmount: money(20_000), customerPaymentStatus: "REFUNDED", settled: false },
    ];
    const summary = calculateSellerCollections(orders);
    expect(summary).toEqual({ stillToCollect: 0, collected: 0, stillToRemit: 0 });
  });

  it("returns all zeros for no orders", () => {
    expect(calculateSellerCollections([])).toEqual({
      stillToCollect: 0,
      collected: 0,
      stillToRemit: 0,
    });
  });
});
