/**
 * Shared CSV primitives for Phase 12 Gate 12A (docs/09-SECURITY.md
 * §46/§47, docs/05-ARCHITECTURE.md §35). One centralized place for
 * quoting and spreadsheet-formula-injection neutralization so no
 * individual export builder has to remember to sanitize a field
 * itself.
 */

/** French/Swiss-locale spreadsheet software defaults to `;`, not `,` (see docs/10-IMPLEMENTATION-PLAN.md Gate 12A). */
export const CSV_DELIMITER = ";";
/** RFC 4180's own row ending, and what Windows Excel expects natively. */
export const CSV_ROW_ENDING = "\r\n";
/** Forces Excel to detect UTF-8 rather than guessing a legacy Windows codepage (corrupts é/è/à/ü otherwise). */
export const CSV_BOM = "﻿";

/**
 * A leading (optionally whitespace-prefixed) `=`/`+`/`-`/`@` can be
 * interpreted as a formula by spreadsheet software. `[ \t\r\n]*`
 * intentionally mirrors exactly the four leading-whitespace characters
 * called out for this gate — space, tab, CR, LF.
 */
const DANGEROUS_PREFIX_PATTERN = /^[ \t\r\n]*[=+\-@]/;

/**
 * Neutralizes a dangerous leading character by prefixing the ORIGINAL
 * value with a single `'` — spreadsheet software renders a leading `'`
 * as "this cell is text" without displaying the apostrophe itself, so
 * a legitimate value (e.g. a Swiss phone number starting with `+`)
 * still reads correctly to a human, it just stops being formula-
 * evaluated. Never trims, strips, or otherwise mutates the value.
 */
export function neutralizeFormulaPrefix(value: string): string {
  return DANGEROUS_PREFIX_PATTERN.test(value) ? `'${value}` : value;
}

/** RFC 4180-style quoting adapted to `CSV_DELIMITER`. */
export function quoteCsvCell(value: string): string {
  const needsQuoting =
    value.includes(CSV_DELIMITER) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  if (!needsQuoting) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Untrusted free text (customer-entered or admin-entered names/
 * addresses/notes) — formula-neutralized, then quoted. `null`/
 * `undefined` become an empty cell, never the literal text "null".
 */
export function csvTextCell(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return quoteCsvCell(neutralizeFormulaPrefix(value));
}

/**
 * A trusted/typed value already produced by this codebase (a label
 * function, a formatted date, a formatted money string, a count) —
 * quoted only, never formula-neutralized. Neutralizing here would
 * corrupt a legitimately negative amount or misrepresent a system
 * value as untrusted input.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return quoteCsvCell(String(value));
}

export function buildCsvRow(cells: readonly string[]): string {
  return cells.join(CSV_DELIMITER);
}

/** Assembles a complete CSV document: BOM, header row, data rows, each cell already formatted by the caller. */
export function buildCsvDocument(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [header.map((cell) => csvCell(cell)), ...rows].map((row) => buildCsvRow(row));
  return CSV_BOM + lines.join(CSV_ROW_ENDING) + CSV_ROW_ENDING;
}
