import { describe, expect, it } from "vitest";
import { generateUniqueSlug, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugify("Chasselas")).toBe("chasselas");
  });

  it("strips accents", () => {
    expect(slugify("Œil-de-Perdrix")).toBe("oeil-de-perdrix");
    expect(slugify("Café de la Région")).toBe("cafe-de-la-region");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("Domaine des Coteaux — Vente 2026")).toBe("domaine-des-coteaux-vente-2026");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  —Vente 2026—  ")).toBe("vente-2026");
  });

  it("returns an empty string for input with no alphanumeric content", () => {
    expect(slugify("—— …")).toBe("");
  });
});

describe("generateUniqueSlug", () => {
  it("returns the base slug when it is free", async () => {
    const slug = await generateUniqueSlug("Les Vins de Mélodia 2027", async () => false);
    expect(slug).toBe("les-vins-de-melodia-2027");
  });

  it("appends -2 when the base slug is taken", async () => {
    const taken = new Set(["les-vins-de-melodia-2027"]);
    const slug = await generateUniqueSlug("Les Vins de Mélodia 2027", async (c) => taken.has(c));
    expect(slug).toBe("les-vins-de-melodia-2027-2");
  });

  it("keeps incrementing past multiple collisions", async () => {
    const taken = new Set(["chasselas", "chasselas-2", "chasselas-3"]);
    const slug = await generateUniqueSlug("Chasselas", async (c) => taken.has(c));
    expect(slug).toBe("chasselas-4");
  });

  it("throws after exhausting maxAttempts against a permanently-taken slug", async () => {
    await expect(generateUniqueSlug("Chasselas", async () => true, 3)).rejects.toThrow(/exhausted/);
  });
});
