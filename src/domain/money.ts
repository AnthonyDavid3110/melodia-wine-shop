/**
 * CHF minor units (rappen) as a branded integer. `Money` exists purely
 * as a compile-time guard against accidentally mixing raw floats/major
 * units into financial arithmetic — at runtime it is just a number.
 * The database is the authoritative integer-minor-units store; this
 * module is the one place that formats/combines those integers
 * (docs/04-DATA-MODEL.md §2.2, CLAUDE.md §15).
 */
export type Money = number & { readonly __brand: "Money" };

/** Wraps an integer minor-units value as Money. Throws on non-integers. */
export function money(minorUnits: number): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Money must be an integer number of minor units, received ${minorUnits}`);
  }
  return minorUnits as Money;
}

export function addMoney(a: Money, b: Money): Money {
  return money(a + b);
}

export function sumMoney(amounts: readonly Money[]): Money {
  return money(amounts.reduce((total, amount) => total + amount, 0));
}

/** unitAmount × quantity — the line-total building block (BR-PRI-001). */
export function multiplyMoney(unitAmount: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new Error(`quantity must be an integer, received ${quantity}`);
  }
  return money(unitAmount * quantity);
}

export function subtractMoney(a: Money, b: Money): Money {
  return money(a - b);
}

/**
 * Swiss formatting (docs/07-DESIGN-SYSTEM.md §18/§37): whole francs use
 * "CHF 18.–", amounts with rappen use "CHF 18.50".
 */
export function formatCHF(amount: Money): string {
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const francs = Math.trunc(absolute / 100);
  const rappen = absolute % 100;
  const sign = negative ? "-" : "";
  const francsPart = francs.toLocaleString("fr-CH");

  return rappen === 0
    ? `${sign}CHF ${francsPart}.–`
    : `${sign}CHF ${francsPart}.${rappen.toString().padStart(2, "0")}`;
}
