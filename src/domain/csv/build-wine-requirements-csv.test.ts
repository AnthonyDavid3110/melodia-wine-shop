import { describe, expect, it } from "vitest";
import {
  buildWineRequirementsCsv,
  type WineRequirementExportRow,
} from "./build-wine-requirements-csv";
import { parseCsvDocument } from "./csv-test-utils";

describe("buildWineRequirementsCsv", () => {
  it("produces the exact deterministic header order", () => {
    const { header } = parseCsvDocument(buildWineRequirementsCsv([]));
    expect(header).toEqual(["vin", "bouteilles", "cartons", "bouteillesRestantes"]);
  });

  it("reuses calculateCartonBreakdown for the carton columns, never recomputing bottle totals", () => {
    const rows: WineRequirementExportRow[] = [{ productName: "Chasselas", bottles: 137 }];
    const { rows: parsedRows } = parseCsvDocument(buildWineRequirementsCsv(rows));
    const row = parsedRows[0]!;
    expect(row[0]).toBe("Chasselas");
    expect(row[1]).toBe("137");
    expect(row[2]).toBe("22"); // 137 / 6 = 22 cartons
    expect(row[3]).toBe("5"); // 137 % 6 = 5 loose bottles
  });

  it("handles an exact multiple of a carton with zero loose bottles", () => {
    const { rows } = parseCsvDocument(
      buildWineRequirementsCsv([{ productName: "Pinot Noir", bottles: 36 }]),
    );
    expect(rows[0]![2]).toBe("6");
    expect(rows[0]![3]).toBe("0");
  });

  it("neutralizes a formula-injection attempt in a product name", () => {
    const { rows } = parseCsvDocument(
      buildWineRequirementsCsv([{ productName: "-DROP TABLE", bottles: 1 }]),
    );
    expect(rows[0]![0]).toBe("'-DROP TABLE");
  });

  it("does not leak a raw product UUID", () => {
    const doc = buildWineRequirementsCsv([{ productName: "Chasselas", bottles: 1 }]);
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
