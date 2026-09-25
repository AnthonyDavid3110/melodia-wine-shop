import { describe, expect, it } from "vitest";
import { money } from "../money";
import { buildPrimaryKpis } from "./build-primary-kpis";

describe("buildPrimaryKpis", () => {
  it("sums revenue and counts orders, excluding CANCELLED", () => {
    const kpis = buildPrimaryKpis(
      [
        { status: "CONFIRMED", totalAmount: money(18_00) },
        { status: "DELIVERED", totalAmount: money(24_00) },
        { status: "CANCELLED", totalAmount: money(99_00) },
      ],
      12,
    );
    expect(kpis.revenue).toBe(42_00);
    expect(kpis.orderCount).toBe(2);
    expect(kpis.bottleCount).toBe(12);
  });

  it("computes average order value as an integer minor-units amount", () => {
    const kpis = buildPrimaryKpis(
      [
        { status: "CONFIRMED", totalAmount: money(10_00) },
        { status: "CONFIRMED", totalAmount: money(15_00) },
        { status: "CONFIRMED", totalAmount: money(16_00) },
      ],
      0,
    );
    // (1000 + 1500 + 1600) / 3 = 1366.67 -> rounds to 1367
    expect(kpis.averageOrderValue).toBe(13_67);
  });

  it("returns null average order value for zero eligible orders, never dividing by zero", () => {
    const kpis = buildPrimaryKpis([{ status: "CANCELLED", totalAmount: money(50_00) }], 0);
    expect(kpis.orderCount).toBe(0);
    expect(kpis.revenue).toBe(0);
    expect(kpis.averageOrderValue).toBeNull();
  });

  it("returns zeros for no orders at all", () => {
    const kpis = buildPrimaryKpis([], 0);
    expect(kpis).toEqual({ revenue: 0, orderCount: 0, bottleCount: 0, averageOrderValue: null });
  });
});
