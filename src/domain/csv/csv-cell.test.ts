import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  CSV_DELIMITER,
  CSV_ROW_ENDING,
  buildCsvDocument,
  csvCell,
  csvTextCell,
  neutralizeFormulaPrefix,
  quoteCsvCell,
} from "./csv-cell";

describe("neutralizeFormulaPrefix", () => {
  it("leaves plain text unchanged", () => {
    expect(neutralizeFormulaPrefix("Jean Dupont")).toBe("Jean Dupont");
  });

  it.each([["="], ["+"], ["-"], ["@"]])("prefixes a leading %s with an apostrophe", (prefix) => {
    expect(neutralizeFormulaPrefix(`${prefix}SUM(A1:A9)`)).toBe(`'${prefix}SUM(A1:A9)`);
  });

  it.each([[" "], ["\t"], ["\r"], ["\n"]])(
    "prefixes a value with leading whitespace (%j) before a formula character",
    (whitespace) => {
      expect(neutralizeFormulaPrefix(`${whitespace}=FORMULA`)).toBe(`'${whitespace}=FORMULA`);
    },
  );

  it("handles the exact approved cases: space/tab/CR/LF before each trigger character", () => {
    expect(neutralizeFormulaPrefix(" =FORMULA")).toBe("' =FORMULA");
    expect(neutralizeFormulaPrefix("\t=FORMULA")).toBe("'\t=FORMULA");
    expect(neutralizeFormulaPrefix("\r=FORMULA")).toBe("'\r=FORMULA");
    expect(neutralizeFormulaPrefix("\n=FORMULA")).toBe("'\n=FORMULA");
    expect(neutralizeFormulaPrefix(" +FORMULA")).toBe("' +FORMULA");
    expect(neutralizeFormulaPrefix("\t@FORMULA")).toBe("'\t@FORMULA");
  });

  it("does not mutate a legitimate Swiss phone number starting with +", () => {
    const phone = "+41 79 123 45 67";
    const result = neutralizeFormulaPrefix(phone);
    // Neutralized (prefixed), but the original digits/spacing are fully preserved after the marker.
    expect(result).toBe(`'${phone}`);
    expect(result.slice(1)).toBe(phone);
  });

  it("never trims or otherwise mutates a value with no dangerous prefix", () => {
    expect(neutralizeFormulaPrefix("  leading spaces, no formula")).toBe(
      "  leading spaces, no formula",
    );
  });

  it("leaves an empty string unchanged", () => {
    expect(neutralizeFormulaPrefix("")).toBe("");
  });
});

describe("quoteCsvCell", () => {
  it("leaves a plain value unquoted", () => {
    expect(quoteCsvCell("Chasselas")).toBe("Chasselas");
  });

  it("quotes a value containing the delimiter", () => {
    expect(quoteCsvCell(`a${CSV_DELIMITER}b`)).toBe(`"a${CSV_DELIMITER}b"`);
  });

  it("quotes and doubles internal double quotes", () => {
    expect(quoteCsvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("quotes a value containing CR", () => {
    expect(quoteCsvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("quotes a value containing LF", () => {
    expect(quoteCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes a value containing CRLF", () => {
    expect(quoteCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("preserves French accented characters unquoted when no special character is present", () => {
    expect(quoteCsvCell("Amélie Müller — Genève")).toBe("Amélie Müller — Genève");
  });
});

describe("csvTextCell", () => {
  it("combines formula neutralization and quoting for untrusted text", () => {
    expect(csvTextCell(`=SUM(A1)${CSV_DELIMITER}B`)).toBe(`"'=SUM(A1)${CSV_DELIMITER}B"`);
  });

  it("returns an empty cell for null", () => {
    expect(csvTextCell(null)).toBe("");
  });

  it("returns an empty cell for undefined", () => {
    expect(csvTextCell(undefined)).toBe("");
  });

  it("returns an empty cell for an empty string", () => {
    expect(csvTextCell("")).toBe("");
  });
});

describe("csvCell (trusted/typed values)", () => {
  it("never applies formula neutralization to a typed value", () => {
    // A legitimately negative money string must never be apostrophe-prefixed.
    expect(csvCell("-18.50")).toBe("-18.50");
  });

  it("still quotes a typed value if it happens to contain the delimiter", () => {
    expect(csvCell(`1${CSV_DELIMITER}2`)).toBe(`"1${CSV_DELIMITER}2"`);
  });

  it("stringifies a number", () => {
    expect(csvCell(42)).toBe("42");
  });

  it("returns an empty cell for null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("buildCsvDocument", () => {
  it("prepends the UTF-8 BOM, joins with the delimiter, and uses CRLF row endings", () => {
    const doc = buildCsvDocument(["a", "b"], [["1", "2"]]);
    expect(doc.startsWith(CSV_BOM)).toBe(true);
    expect(doc).toBe(
      `${CSV_BOM}a${CSV_DELIMITER}b${CSV_ROW_ENDING}1${CSV_DELIMITER}2${CSV_ROW_ENDING}`,
    );
  });

  it("produces a header-only document for zero rows", () => {
    const doc = buildCsvDocument(["a", "b"], []);
    expect(doc).toBe(`${CSV_BOM}a${CSV_DELIMITER}b${CSV_ROW_ENDING}`);
  });
});
