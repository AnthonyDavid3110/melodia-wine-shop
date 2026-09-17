import { describe, expect, it } from "vitest";
import { addMoney, formatCHF, money, multiplyMoney, subtractMoney, sumMoney } from "./money";

describe("money", () => {
  it("wraps an integer minor-units value", () => {
    expect(money(1800)).toBe(1800);
  });

  it("rejects non-integer values", () => {
    expect(() => money(18.5)).toThrow(/integer/);
  });
});

describe("addMoney / sumMoney", () => {
  it("adds two amounts without float drift", () => {
    expect(addMoney(money(1800), money(2200))).toBe(4000);
  });

  it("sums a list of amounts", () => {
    expect(sumMoney([money(1800), money(2200), money(100)])).toBe(4100);
  });

  it("sums an empty list to zero", () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe("multiplyMoney", () => {
  it("computes a line total from unit price and quantity", () => {
    expect(multiplyMoney(money(1800), 3)).toBe(5400);
  });

  it("rejects a non-integer quantity", () => {
    expect(() => multiplyMoney(money(1800), 1.5)).toThrow(/quantity/);
  });
});

describe("subtractMoney", () => {
  it("subtracts refunded amounts from a total", () => {
    expect(subtractMoney(money(5000), money(1200))).toBe(3800);
  });
});

describe("formatCHF", () => {
  it("formats a whole-franc amount with the Swiss dash", () => {
    expect(formatCHF(money(1800))).toBe("CHF 18.–");
  });

  it("formats an amount with rappen", () => {
    expect(formatCHF(money(1850))).toBe("CHF 18.50");
  });

  it("pads single-digit rappen", () => {
    expect(formatCHF(money(1805))).toBe("CHF 18.05");
  });

  it("groups thousands per Swiss convention", () => {
    expect(formatCHF(money(1_000_000))).toBe("CHF 10'000.–");
  });

  it("formats zero", () => {
    expect(formatCHF(money(0))).toBe("CHF 0.–");
  });

  it("formats a negative amount", () => {
    expect(formatCHF(money(-1800))).toBe("-CHF 18.–");
  });
});
