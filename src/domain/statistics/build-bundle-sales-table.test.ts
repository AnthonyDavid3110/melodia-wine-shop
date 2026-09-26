import { describe, expect, it } from "vitest";
import { money } from "../money";
import { buildBundleSalesTable } from "./build-bundle-sales-table";

describe("buildBundleSalesTable", () => {
  it("sums quantity and revenue for the same bundle across multiple order lines", () => {
    const rows = buildBundleSalesTable([
      {
        orderStatus: "CONFIRMED",
        itemType: "BUNDLE",
        bundleId: "carton",
        nameSnapshot: "Carton découverte",
        quantity: 2,
        lineTotalAmount: money(200_00),
      },
      {
        orderStatus: "DELIVERED",
        itemType: "BUNDLE",
        bundleId: "carton",
        nameSnapshot: "Carton découverte",
        quantity: 1,
        lineTotalAmount: money(100_00),
      },
    ]);
    expect(rows).toEqual([
      { bundleId: "carton", name: "Carton découverte", quantitySold: 3, revenue: 300_00 },
    ]);
  });

  it("excludes PRODUCT lines and CANCELLED order lines", () => {
    const rows = buildBundleSalesTable([
      {
        orderStatus: "CONFIRMED",
        itemType: "PRODUCT",
        bundleId: null,
        nameSnapshot: "Chasselas",
        quantity: 1,
        lineTotalAmount: money(18_00),
      },
      {
        orderStatus: "CANCELLED",
        itemType: "BUNDLE",
        bundleId: "carton",
        nameSnapshot: "Carton découverte",
        quantity: 5,
        lineTotalAmount: money(500_00),
      },
    ]);
    expect(rows).toEqual([]);
  });

  it("sorts by revenue descending", () => {
    const rows = buildBundleSalesTable([
      {
        orderStatus: "CONFIRMED",
        itemType: "BUNDLE",
        bundleId: "small",
        nameSnapshot: "Petit carton",
        quantity: 1,
        lineTotalAmount: money(50_00),
      },
      {
        orderStatus: "CONFIRMED",
        itemType: "BUNDLE",
        bundleId: "big",
        nameSnapshot: "Grand carton",
        quantity: 1,
        lineTotalAmount: money(150_00),
      },
    ]);
    expect(rows.map((r) => r.bundleId)).toEqual(["big", "small"]);
  });

  it("returns an empty table for no bundle sales", () => {
    expect(buildBundleSalesTable([])).toEqual([]);
  });
});
