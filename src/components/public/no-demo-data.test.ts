import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 4 Gate 2: proves, by inspecting source rather than trusting a
 * description, that the production public-catalog components never
 * hardcode a seeded/demo wine name and never import anything from the
 * design-system-only demo data modules. Pure source-text checks (no
 * DOM, no DB) — mirrors the pattern already used in
 * src/infrastructure/auth/bootstrap-isolation.test.ts.
 */

const PUBLIC_COMPONENTS_DIR = "src/components/public";
const PUBLIC_APP_FILES = ["src/app/page.tsx"];

// Every wine name that exists in the development seed
// (src/infrastructure/database/seed.ts) — production code must never
// reference any of these literally.
const SEEDED_WINE_NAMES = [
  "Chasselas",
  "Chardonnay",
  "Œil-de-Perdrix",
  "Pinot Noir",
  "Gamaret",
  "Merlot",
];

function publicSourceFiles(): string[] {
  const files = readdirSync(PUBLIC_COMPONENTS_DIR)
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts"))
    .map((name) => join(PUBLIC_COMPONENTS_DIR, name));
  return [...files, ...PUBLIC_APP_FILES];
}

describe("public catalog components contain no hardcoded seed/demo data", () => {
  it("never references a seeded wine name literally", () => {
    for (const file of publicSourceFiles()) {
      const source = readFileSync(file, "utf-8");
      for (const name of SEEDED_WINE_NAMES) {
        expect(source, `${file} should not contain the literal seeded wine name "${name}"`).not.toContain(
          name,
        );
      }
    }
  });

  it("never imports from the design-system-only demo directory", () => {
    for (const file of publicSourceFiles()) {
      const source = readFileSync(file, "utf-8");
      expect(source, `${file} must not import from design-system`).not.toMatch(
        /from\s+["'].*design-system/,
      );
      expect(source, `${file} must not import demoWines`).not.toMatch(/demoWines/);
    }
  });

  it("never renders an 'Ajouter' purchase/cart control (Phase 4 has no cart)", () => {
    for (const file of publicSourceFiles()) {
      const source = readFileSync(file, "utf-8");
      expect(source, `${file} must not contain an "Ajouter" control`).not.toMatch(/Ajouter/);
    }
  });
});
