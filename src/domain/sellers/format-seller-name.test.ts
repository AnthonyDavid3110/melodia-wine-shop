import { describe, expect, it } from "vitest";
import { formatSellerName } from "./format-seller-name";

describe("formatSellerName", () => {
  it("formats as firstName lastName", () => {
    expect(formatSellerName({ firstName: "Anne", lastName: "Bornand" })).toBe("Anne Bornand");
  });
});
