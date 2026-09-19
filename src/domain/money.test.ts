import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatCHF,
  money,
  multiplyMoney,
  parseCHF,
  subtractMoney,
  sumMoney,
} from "./money";

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

describe("parseCHF", () => {
  it("parses a whole-franc integer", () => {
    const result = parseCHF("18");
    expect(result).toEqual({ ok: true, value: money(1800) });
  });

  it("parses a period-separated decimal", () => {
    expect(parseCHF("18.50")).toEqual({ ok: true, value: money(1850) });
  });

  it("parses a comma-separated decimal", () => {
    expect(parseCHF("18,50")).toEqual({ ok: true, value: money(1850) });
  });

  it("parses a single decimal digit by padding to rappen", () => {
    expect(parseCHF("18.5")).toEqual({ ok: true, value: money(1850) });
  });

  it("parses zero as valid (a readiness-warning case, not a parse error)", () => {
    expect(parseCHF("0")).toEqual({ ok: true, value: money(0) });
  });

  it("trims surrounding whitespace", () => {
    expect(parseCHF("  18.50  ")).toEqual({ ok: true, value: money(1850) });
  });

  it("rejects more than two decimal places rather than rounding", () => {
    const result = parseCHF("18.123");
    expect(result.ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = parseCHF("-5");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/négatif/);
  });

  it("rejects non-numeric input", () => {
    expect(parseCHF("abc").ok).toBe(false);
    expect(parseCHF("18 CHF").ok).toBe(false);
    expect(parseCHF("CHF 18").ok).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = parseCHF("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/requis/);
  });

  it("rejects a value that is only a decimal point", () => {
    expect(parseCHF("18.").ok).toBe(false);
    expect(parseCHF(".50").ok).toBe(false);
  });

  it("never uses floating-point multiplication — exact for known float-hazard values", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE754 — a naive `parseFloat(x) * 100` on a
    // value like this can drift. Confirms exactness via known hazards.
    expect(parseCHF("19.99")).toEqual({ ok: true, value: money(1999) });
    expect(parseCHF("0.29")).toEqual({ ok: true, value: money(29) });
  });
});
