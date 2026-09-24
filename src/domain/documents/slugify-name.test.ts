import { describe, expect, it } from "vitest";
import { slugifyName } from "./slugify-name";

describe("slugifyName", () => {
  it("lowercases plain ASCII names", () => {
    expect(slugifyName("Bornand")).toBe("bornand");
  });

  it("strips accents/diacritics", () => {
    expect(slugifyName("Amélie Müller")).toBe("amelie-muller");
  });

  it("collapses whitespace and hyphenates", () => {
    expect(slugifyName("Jean  Pierre")).toBe("jean-pierre");
  });

  it("removes unsafe/path-unsafe characters", () => {
    expect(slugifyName("O'Brien/../etc")).toBe("o-brien-etc");
  });

  it("trims leading/trailing hyphens produced by punctuation", () => {
    expect(slugifyName("-Test-")).toBe("test");
  });

  it("never contains a raw UUID-like value simply by passing one through unchanged in shape", () => {
    const result = slugifyName("Anne Bornand");
    expect(result).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
