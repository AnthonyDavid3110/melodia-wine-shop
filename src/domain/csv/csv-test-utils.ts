/**
 * Minimal RFC 4180-aware parser used ONLY by this gate's unit tests to
 * assert on a builder's output as structured rows rather than raw
 * text — never used by production code. Not itself a `.test.ts` file
 * so it isn't collected as its own (empty) test suite.
 */
export function parseCsvDocument(doc: string): { header: string[]; rows: string[][] } {
  const withoutBom = doc.startsWith("﻿") ? doc.slice(1) : doc;
  const allRows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < withoutBom.length) {
    const char = withoutBom[i];

    if (inQuotes) {
      if (char === '"') {
        if (withoutBom[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ";") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      row.push(cell);
      cell = "";
      allRows.push(row);
      row = [];
      i += char === "\r" && withoutBom[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    cell += char;
    i += 1;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    allRows.push(row);
  }

  const [header, ...dataRows] = allRows;
  return { header: header ?? [], rows: dataRows };
}
