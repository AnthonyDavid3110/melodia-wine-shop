import { describe, expect, it } from "vitest";
import { calculateCartonBreakdown } from "./calculate-carton-breakdown";

describe("calculateCartonBreakdown", () => {
  const cases: Array<[number, { cartons: number; looseBottles: number }]> = [
    [0, { cartons: 0, looseBottles: 0 }],
    [1, { cartons: 0, looseBottles: 1 }],
    [5, { cartons: 0, looseBottles: 5 }],
    [6, { cartons: 1, looseBottles: 0 }],
    [7, { cartons: 1, looseBottles: 1 }],
    [12, { cartons: 2, looseBottles: 0 }],
    [13, { cartons: 2, looseBottles: 1 }],
    [137, { cartons: 22, looseBottles: 5 }],
  ];

  it.each(cases)("breaks down %i bottles correctly", (bottles, expected) => {
    expect(calculateCartonBreakdown(bottles)).toEqual(expected);
  });

  it("never changes the authoritative total: cartons * 6 + looseBottles === bottles", () => {
    for (const [bottles] of cases) {
      const { cartons, looseBottles } = calculateCartonBreakdown(bottles);
      expect(cartons * 6 + looseBottles).toBe(bottles);
    }
  });

  it("supports a custom bottlesPerCarton", () => {
    expect(calculateCartonBreakdown(10, 3)).toEqual({ cartons: 3, looseBottles: 1 });
  });

  it("rejects a negative bottle count", () => {
    expect(() => calculateCartonBreakdown(-1)).toThrow();
  });

  it("rejects a non-integer bottle count", () => {
    expect(() => calculateCartonBreakdown(1.5)).toThrow();
  });

  it("rejects a non-positive bottlesPerCarton", () => {
    expect(() => calculateCartonBreakdown(6, 0)).toThrow();
  });
});
