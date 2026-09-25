import { describe, expect, it } from "vitest";
import { buildOperationalKpis } from "./build-operational-kpis";

describe("buildOperationalKpis", () => {
  it("counts each operational bucket by status", () => {
    const kpis = buildOperationalKpis([
      { status: "CONFIRMED", sellerId: "seller-1" },
      { status: "CONFIRMED", sellerId: "seller-1" },
      { status: "PREPARED", sellerId: "seller-1" },
      { status: "DELIVERED", sellerId: "seller-1" },
      { status: "HANDED_TO_SELLER", sellerId: "seller-1" },
    ]);
    expect(kpis).toEqual({ unassignedOrders: 0, toPrepare: 2, prepared: 1, delivered: 1 });
  });

  it("counts unassigned orders, excluding CANCELLED", () => {
    const kpis = buildOperationalKpis([
      { status: "CONFIRMED", sellerId: null },
      { status: "NEW", sellerId: null },
      { status: "CANCELLED", sellerId: null },
      { status: "CONFIRMED", sellerId: "seller-1" },
    ]);
    expect(kpis.unassignedOrders).toBe(2);
  });

  it("returns zeros for no orders", () => {
    expect(buildOperationalKpis([])).toEqual({
      unassignedOrders: 0,
      toPrepare: 0,
      prepared: 0,
      delivered: 0,
    });
  });
});
