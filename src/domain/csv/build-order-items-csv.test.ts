import { describe, expect, it } from "vitest";
import { buildOrderItemsCsv, type OrderItemExportRow } from "./build-order-items-csv";
import { parseCsvDocument } from "./csv-test-utils";

function productRow(overrides: Partial<OrderItemExportRow> = {}): OrderItemExportRow {
  return {
    orderNumber: "ECM-2026-0001",
    orderStatus: "CONFIRMED",
    itemType: "PRODUCT",
    nameSnapshot: "Chasselas",
    unitPriceAmount: 1800,
    quantity: 2,
    lineTotalAmount: 3600,
    bundleComponents: [],
    ...overrides,
  };
}

describe("buildOrderItemsCsv", () => {
  it("produces the exact deterministic header order", () => {
    const { header } = parseCsvDocument(buildOrderItemsCsv([]));
    expect(header).toEqual([
      "numeroCommande",
      "statutCommande",
      "type",
      "article",
      "composition",
      "quantite",
      "prixUnitaireCHF",
      "totalLigneCHF",
    ]);
  });

  it("represents a PRODUCT line correctly, with an empty composition column", () => {
    const { rows } = parseCsvDocument(buildOrderItemsCsv([productRow()]));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row[0]).toBe("ECM-2026-0001");
    expect(row[1]).toBe("Confirmée");
    expect(row[2]).toBe("Vin");
    expect(row[3]).toBe("Chasselas");
    expect(row[4]).toBe("");
    expect(row[5]).toBe("2");
    expect(row[6]).toBe("18.00");
    expect(row[7]).toBe("36.00");
  });

  it("keeps a BUNDLE row's own snapshotted price/quantity/total, with a human composition column", () => {
    const bundleRow = productRow({
      itemType: "BUNDLE",
      nameSnapshot: "Coffret Découverte",
      unitPriceAmount: 4500,
      quantity: 1,
      lineTotalAmount: 4500,
      bundleComponents: [
        { productNameSnapshot: "Chasselas", quantityPerBundle: 2 },
        { productNameSnapshot: "Pinot Noir", quantityPerBundle: 1 },
      ],
    });
    const { rows } = parseCsvDocument(buildOrderItemsCsv([bundleRow]));
    const row = rows[0]!;
    expect(row[2]).toBe("Bundle");
    expect(row[3]).toBe("Coffret Découverte");
    expect(row[4]).toBe("2× Chasselas; 1× Pinot Noir");
    expect(row[6]).toBe("45.00");
    expect(row[7]).toBe("45.00");
  });

  it("never derives a component-level price — the bundle's own line total is the only money for that row", () => {
    // Two components, but exactly one row, exactly one total — no
    // fabricated per-component price anywhere in the output.
    const doc = buildOrderItemsCsv([
      productRow({
        itemType: "BUNDLE",
        lineTotalAmount: 4500,
        bundleComponents: [
          { productNameSnapshot: "Chasselas", quantityPerBundle: 2 },
          { productNameSnapshot: "Pinot Noir", quantityPerBundle: 1 },
        ],
      }),
    ]);
    const { rows } = parseCsvDocument(doc);
    expect(rows).toHaveLength(1);
  });

  it("includes a line belonging to a CANCELLED order with its explicit status (approved §6)", () => {
    const { rows } = parseCsvDocument(
      buildOrderItemsCsv([productRow({ orderStatus: "CANCELLED" })]),
    );
    expect(rows[0]![1]).toBe("Annulée");
  });

  it("neutralizes a formula-injection attempt in a product name snapshot", () => {
    const { rows } = parseCsvDocument(
      buildOrderItemsCsv([productRow({ nameSnapshot: "@IMPORTXML(...)" })]),
    );
    expect(rows[0]![3]).toBe("'@IMPORTXML(...)");
  });

  it("does not leak a raw UUID (orderId/itemId are never part of the input shape)", () => {
    const doc = buildOrderItemsCsv([productRow()]);
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
