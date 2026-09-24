import { formatCsvDate } from "./format-csv-date";

/**
 * Centralized, deterministic filename convention for Gate 12A exports —
 * never a UUID, never customer/seller PII, just the export's own name
 * and the generation date (docs/09-SECURITY.md, "no internal ID
 * leakage"). One place so every download Route Handler stays
 * consistent.
 */
export function generateExportFilename(exportSlug: string, generatedAt: Date = new Date()): string {
  return `${exportSlug}-${formatCsvDate(generatedAt)}.csv`;
}
