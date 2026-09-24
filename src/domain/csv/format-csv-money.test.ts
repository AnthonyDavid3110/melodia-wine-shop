import { describe, expect, it } from "vitest";
import { money } from "../money";
import { formatCsvMoney } from "./format-csv-money";

describe("formatCsvMoney", () => {
  it("formats a whole-franc amount with two decimals", () => {
    expect(formatCsvMoney(money(1800))).toBe("18.00");
  });

  it("formats an amount with rappen", () => {
    expect(formatCsvMoney(money(1850))).toBe("18.50");
  });

  it("formats zero", () => {
    expect(formatCsvMoney(money(0))).toBe("0.00");
  });

  it("formats a negative amount with a leading minus, never apostrophe-prefixed", () => {
    expect(formatCsvMoney(money(-1850))).toBe("-18.50");
  });

  it("never uses a locale-dependent thousands separator", () => {
    expect(formatCsvMoney(money(123456))).toBe("1234.56");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCsvMoney(null)).toBe("");
    expect(formatCsvMoney(undefined)).toBe("");
  });
});
