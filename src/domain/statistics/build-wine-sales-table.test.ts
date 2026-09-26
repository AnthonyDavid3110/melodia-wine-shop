import { describe, expect, it } from "vitest";
import { money } from "../money";
import { buildWineSalesTable } from "./build-wine-sales-table";

describe("buildWineSalesTable", () => {
  it("attaches direct-sales revenue to the matching wine by productId", () => {
    const rows = buildWineSalesTable(
      [{ productId: "chasselas", productName: "Chasselas", bottles: 12 }],
      [
        {
          orderStatus: "CONFIRMED",
          itemType: "PRODUCT",
          productId: "chasselas",
          lineTotalAmount: money(18_00),
        },
        {
          orderStatus: "DELIVERED",
          itemType: "PRODUCT",
          productId: "chasselas",
          lineTotalAmount: money(18_00),
        },
      ],
    );
    expect(rows).toEqual([
      { productId: "chasselas", name: "Chasselas", bottles: 12, directRevenue: 36_00 },
    ]);
  });

  it("gives a bundle-only wine zero direct revenue while keeping its bundle-inclusive bottle count", () => {
    const rows = buildWineSalesTable(
      [{ productId: "pinot", productName: "Pinot Noir", bottles: 6 }],
      [
        // A bundle line for a different product must never contribute here.
        {
          orderStatus: "CONFIRMED",
          itemType: "BUNDLE",
          productId: null,
          lineTotalAmount: money(100_00),
        },
      ],
    );
    expect(rows).toEqual([
      { productId: "pinot", name: "Pinot Noir", bottles: 6, directRevenue: 0 },
    ]);
  });

  it("excludes CANCELLED order lines from direct revenue", () => {
    const rows = buildWineSalesTable(
      [{ productId: "chasselas", productName: "Chasselas", bottles: 0 }],
      [
        {
          orderStatus: "CANCELLED",
          itemType: "PRODUCT",
          productId: "chasselas",
          lineTotalAmount: money(99_00),
        },
      ],
    );
    expect(rows[0]!.directRevenue).toBe(0);
  });

  it("returns an empty table for a campaign with no wines", () => {
    expect(buildWineSalesTable([], [])).toEqual([]);
  });
});
