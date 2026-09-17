/**
 * Pure formatting/parsing for the human-readable order number
 * (docs/04-DATA-MODEL.md §14: ECM-YYYY-NNNN). Safe concurrent
 * generation of the sequence itself is an infrastructure concern (the
 * order_number_counters table, docs/05-ARCHITECTURE.md §50) exercised
 * later against a real database — this module only formats/parses the
 * string.
 */

const ORDER_NUMBER_PATTERN = /^ECM-(\d{4})-(\d{4,})$/;

export function formatOrderNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`year must be a 4-digit integer, received ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`sequence must be a positive integer, received ${sequence}`);
  }

  return `ECM-${year}-${sequence.toString().padStart(4, "0")}`;
}

export interface ParsedOrderNumber {
  year: number;
  sequence: number;
}

/** Returns null for anything that isn't a well-formed ECM-YYYY-NNNN string, rather than throwing. */
export function parseOrderNumber(orderNumber: string): ParsedOrderNumber | null {
  const match = ORDER_NUMBER_PATTERN.exec(orderNumber);
  if (!match) {
    return null;
  }

  const [, yearPart, sequencePart] = match;
  return { year: Number(yearPart), sequence: Number(sequencePart) };
}
