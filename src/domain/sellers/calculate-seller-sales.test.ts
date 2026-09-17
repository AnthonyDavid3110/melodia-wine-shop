import { describe, expect, it } from "vitest";
import { money } from "../money";
import { calculateSellerSales } from "./calculate-seller-sales";

describe("calculateSellerSales", () => {
  it("sums totals across eligible orders", () => {
    const total = calculateSellerSales([
      { status: "CONFIRMED", totalAmount: money(1800) },
      { status: "DELIVERED", totalAmount: money(2200) },
    ]);
    expect(total).toBe(4000);
  });

  it("excludes cancelled orders (BR-SEL-007)", () => {
    const total = calculateSellerSales([
      { status: "CONFIRMED", totalAmount: money(1800) },
      { status: "CANCELLED", totalAmount: money(9999) },
    ]);
    expect(total).toBe(1800);
  });

  it("subtracts refunded amounts (BR-SEL-008)", () => {
    const total = calculateSellerSales([
      { status: "DELIVERED", totalAmount: money(10_000), refundedAmount: money(3000) },
    ]);
    expect(total).toBe(7000);
  });

  it("treats a cancelled order's refund as irrelevant — the order is already excluded", () => {
    const total = calculateSellerSales([
      { status: "CANCELLED", totalAmount: money(10_000), refundedAmount: money(3000) },
    ]);
    expect(total).toBe(0);
  });

  it("returns zero for no orders", () => {
    expect(calculateSellerSales([])).toBe(0);
  });
});
