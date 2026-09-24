import { describe, expect, it } from "vitest";
import { generateExportFilename } from "./generate-export-filename";

describe("generateExportFilename", () => {
  it("builds a deterministic slug-date filename", () => {
    expect(generateExportFilename("commandes", new Date("2026-09-24T10:00:00Z"))).toBe(
      "commandes-2026-09-24.csv",
    );
  });

  it("never includes a UUID or PII, only the slug and the date", () => {
    const filename = generateExportFilename("ventes-vendeurs", new Date("2026-01-05T00:00:00Z"));
    expect(filename).toBe("ventes-vendeurs-2026-01-05.csv");
    expect(filename).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
