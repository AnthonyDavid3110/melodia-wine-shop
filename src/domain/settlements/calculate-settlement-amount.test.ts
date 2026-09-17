import { describe, expect, it } from "vitest";
import { money } from "../money";
import { calculateSettlementAmount } from "./calculate-settlement-amount";

describe("calculateSettlementAmount", () => {
  it("matches the docs/04-DATA-MODEL.md §21 worked example", () => {
    const total = calculateSettlementAmount([
      { amount: money(12_000) },
      { amount: money(18_000) },
      { amount: money(10_000) },
    ]);
    expect(total).toBe(40_000);
  });

  it("supports a partial settlement across a subset of outstanding orders (§38)", () => {
    const total = calculateSettlementAmount([{ amount: money(10_000) }, { amount: money(15_000) }]);
    expect(total).toBe(25_000);
  });

  it("returns zero for no selected orders", () => {
    expect(calculateSettlementAmount([])).toBe(0);
  });
});
