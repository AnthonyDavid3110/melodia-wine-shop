import { describe, expect, it } from "vitest";
import { buildSellerSalesCsv, type SellerSalesExportRow } from "./build-seller-sales-csv";
import { parseCsvDocument } from "./csv-test-utils";

function sellerRow(overrides: Partial<SellerSalesExportRow> = {}): SellerSalesExportRow {
  return {
    sellerId: "seller-1",
    sellerName: "Anne Bornand",
    orderCount: 3,
    sales: 58800,
    target: 100000,
    progressPercentage: 59,
    stillToCollect: 19600,
    collected: 39200,
    stillToRemit: 0,
    remittedToEcm: 39200,
    ...overrides,
  };
}

describe("buildSellerSalesCsv", () => {
  it("produces the exact deterministic header order", () => {
    const { header } = parseCsvDocument(buildSellerSalesCsv([]));
    expect(header).toEqual([
      "vendeur",
      "nombreCommandes",
      "ventesCHF",
      "objectifCHF",
      "progressionPct",
      "resteAEncaisserCHF",
      "encaisseCHF",
      "resteARemettreCHF",
      "remisAMelodiaCHF",
    ]);
  });

  it("formats a seller row using the caller's already-computed figures, without recomputing anything", () => {
    const { rows } = parseCsvDocument(buildSellerSalesCsv([sellerRow()]));
    const row = rows[0]!;
    expect(row[0]).toBe("Anne Bornand");
    expect(row[1]).toBe("3");
    expect(row[2]).toBe("588.00");
    expect(row[3]).toBe("1000.00");
    expect(row[4]).toBe("59");
    expect(row[5]).toBe("196.00");
    expect(row[6]).toBe("392.00");
    expect(row[7]).toBe("0.00");
    expect(row[8]).toBe("392.00");
  });

  it("renders the unassigned pseudo-row with an empty target/progress, never a fabricated value", () => {
    const { rows } = parseCsvDocument(
      buildSellerSalesCsv([
        sellerRow({
          sellerId: null,
          sellerName: null,
          orderCount: 1,
          sales: 4500,
          target: null,
          progressPercentage: null,
          stillToCollect: 4500,
          collected: 0,
          stillToRemit: 0,
          remittedToEcm: 0,
        }),
      ]),
    );
    const row = rows[0]!;
    expect(row[0]).toBe("Non attribuée");
    expect(row[3]).toBe("");
    expect(row[4]).toBe("");
  });

  it("neutralizes a formula-injection attempt in a seller display name", () => {
    const { rows } = parseCsvDocument(
      buildSellerSalesCsv([sellerRow({ sellerName: '=HYPERLINK("http://evil")' })]),
    );
    expect(rows[0]![0]).toBe('\'=HYPERLINK("http://evil")');
  });

  it("does not leak a raw seller UUID", () => {
    const doc = buildSellerSalesCsv([
      sellerRow({ sellerId: "5f1e6b3a-2c4d-4e5f-8a9b-1c2d3e4f5a6b" }),
    ]);
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
