import { describe, expect, it } from "vitest";
import { formatProductCategory } from "./product-category-label";

describe("formatProductCategory", () => {
  it("translates known categories to French", () => {
    expect(formatProductCategory("WHITE")).toBe("Blanc");
    expect(formatProductCategory("RED")).toBe("Rouge");
    expect(formatProductCategory("ROSE")).toBe("Rosé");
  });

  it("falls back to the raw value for an unknown category", () => {
    expect(formatProductCategory("SPARKLING")).toBe("SPARKLING");
  });
});
