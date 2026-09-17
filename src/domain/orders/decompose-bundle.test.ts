import { describe, expect, it } from "vitest";
import { decomposeBundle } from "./decompose-bundle";

describe("decomposeBundle", () => {
  it("multiplies each component by the number of bundles ordered", () => {
    const result = decomposeBundle(
      [
        { productId: "wine-a", quantityPerBundle: 1 },
        { productId: "wine-b", quantityPerBundle: 1 },
      ],
      50,
    );
    expect(result).toEqual([
      { productId: "wine-a", quantity: 50 },
      { productId: "wine-b", quantity: 50 },
    ]);
  });

  it("supports a component quantity greater than one per bundle", () => {
    const result = decomposeBundle([{ productId: "wine-a", quantityPerBundle: 2 }], 3);
    expect(result).toEqual([{ productId: "wine-a", quantity: 6 }]);
  });

  it("returns zero-quantity contributions for zero bundles ordered", () => {
    const result = decomposeBundle([{ productId: "wine-a", quantityPerBundle: 1 }], 0);
    expect(result).toEqual([{ productId: "wine-a", quantity: 0 }]);
  });

  it("rejects a negative bundle quantity", () => {
    expect(() => decomposeBundle([], -1)).toThrow(/bundleQuantity/);
  });
});
