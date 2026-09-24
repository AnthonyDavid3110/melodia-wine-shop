import type { Money } from "../money";

/**
 * Plain machine-decimal CHF for a CSV cell — deliberately NOT
 * `formatCHF()` (which produces the locale-formatted "CHF 18.–" display
 * string) and deliberately NOT `toLocaleString()` (which would make the
 * decimal/thousands separators depend on the server's locale — Phase 12
 * Gate 12A explicitly requires machine-readable money columns to stay
 * locale-independent). Always exactly two decimal places, `.` as the
 * decimal separator — safe once the column delimiter is `;`.
 */
export function formatCsvMoney(amount: Money | number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const francs = Math.trunc(absolute / 100);
  const rappen = absolute % 100;
  const sign = negative ? "-" : "";
  return `${sign}${francs}.${rappen.toString().padStart(2, "0")}`;
}
