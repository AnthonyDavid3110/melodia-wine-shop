import { type Money, multiplyMoney, sumMoney } from "../money";

export interface OrderLineInput {
  unitPriceAmount: Money;
  quantity: number;
}

export interface OrderTotal {
  lineTotals: Money[];
  total: Money;
}

/**
 * BR-PRI-001: line total = unit price × quantity, order total = sum of
 * line totals. Assumes the caller has already dropped zero-quantity
 * lines (BR-CART-003) and resolved authoritative unit prices
 * server-side (BR-CART-002) — this function does not touch the
 * database or trust any price it wasn't given.
 */
export function calculateOrderTotal(lines: readonly OrderLineInput[]): OrderTotal {
  const lineTotals = lines.map((line) => multiplyMoney(line.unitPriceAmount, line.quantity));
  return { lineTotals, total: sumMoney(lineTotals) };
}
