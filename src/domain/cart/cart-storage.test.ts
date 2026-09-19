import { describe, expect, it } from "vitest";
import { CART_STORAGE_VERSION, parseStoredCart, serializeCart } from "./cart-storage";
import type { Cart } from "./cart";

const VALID_CART: Cart = {
  campaignId: "campaign-1",
  items: [
    { type: "PRODUCT", id: "wine-1", quantity: 3 },
    { type: "BUNDLE", id: "bundle-1", quantity: 1 },
  ],
};

describe("serializeCart / parseStoredCart round trip", () => {
  it("round-trips a valid cart exactly", () => {
    const parsed = parseStoredCart(serializeCart(VALID_CART));
    expect(parsed).toEqual(VALID_CART);
  });

  it("round-trips an empty cart", () => {
    const empty: Cart = { campaignId: "campaign-1", items: [] };
    expect(parseStoredCart(serializeCart(empty))).toEqual(empty);
  });

  it("writes the current version", () => {
    const stored = JSON.parse(serializeCart(VALID_CART));
    expect(stored.version).toBe(CART_STORAGE_VERSION);
  });
});

describe("parseStoredCart — defensive parsing", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parseStoredCart(null)).toBeNull();
    expect(parseStoredCart(undefined)).toBeNull();
    expect(parseStoredCart("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseStoredCart("{not json")).toBeNull();
  });

  it("returns null for valid JSON that isn't an object (array, string, number)", () => {
    expect(parseStoredCart("[]")).toBeNull();
    expect(parseStoredCart('"hello"')).toBeNull();
    expect(parseStoredCart("42")).toBeNull();
    expect(parseStoredCart("null")).toBeNull();
  });

  it("returns null for an unsupported/missing version", () => {
    expect(parseStoredCart(JSON.stringify({ version: 2, campaignId: "c", items: [] }))).toBeNull();
    expect(parseStoredCart(JSON.stringify({ campaignId: "c", items: [] }))).toBeNull();
  });

  it("returns null for a missing or malformed campaignId", () => {
    expect(parseStoredCart(JSON.stringify({ version: 1, items: [] }))).toBeNull();
    expect(parseStoredCart(JSON.stringify({ version: 1, campaignId: "", items: [] }))).toBeNull();
    expect(parseStoredCart(JSON.stringify({ version: 1, campaignId: 42, items: [] }))).toBeNull();
  });

  it("returns null when items is not an array", () => {
    expect(
      parseStoredCart(JSON.stringify({ version: 1, campaignId: "c", items: "nope" })),
    ).toBeNull();
  });

  it("drops individual malformed items but keeps the rest of the cart", () => {
    const raw = JSON.stringify({
      version: 1,
      campaignId: "c",
      items: [
        { type: "PRODUCT", id: "wine-1", quantity: 2 },
        { type: "SOMETHING_ELSE", id: "wine-2", quantity: 1 },
        { type: "PRODUCT", id: "wine-3" },
        { type: "PRODUCT", quantity: 1 },
        "not-an-object",
        null,
      ],
    });
    const parsed = parseStoredCart(raw);
    expect(parsed?.items).toEqual([{ type: "PRODUCT", id: "wine-1", quantity: 2 }]);
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, "3", null, undefined])(
    "drops an item with an invalid quantity: %p",
    (quantity) => {
      const raw = JSON.stringify({
        version: 1,
        campaignId: "c",
        items: [{ type: "PRODUCT", id: "wine-1", quantity }],
      });
      expect(parseStoredCart(raw)?.items).toEqual([]);
    },
  );

  it("merges duplicate (type, id) pairs by summing quantities", () => {
    const raw = JSON.stringify({
      version: 1,
      campaignId: "c",
      items: [
        { type: "PRODUCT", id: "wine-1", quantity: 2 },
        { type: "PRODUCT", id: "wine-1", quantity: 3 },
      ],
    });
    expect(parseStoredCart(raw)?.items).toEqual([{ type: "PRODUCT", id: "wine-1", quantity: 5 }]);
  });

  it("keeps a product and a bundle with the same id string as distinct lines", () => {
    const raw = JSON.stringify({
      version: 1,
      campaignId: "c",
      items: [
        { type: "PRODUCT", id: "shared", quantity: 1 },
        { type: "BUNDLE", id: "shared", quantity: 2 },
      ],
    });
    expect(parseStoredCart(raw)?.items).toHaveLength(2);
  });

  it("never persists price, name, or any other field even if present in storage", () => {
    const raw = JSON.stringify({
      version: 1,
      campaignId: "c",
      items: [
        { type: "PRODUCT", id: "wine-1", quantity: 1, unitPriceAmount: 999_999, name: "Fake Wine" },
      ],
    });
    const parsed = parseStoredCart(raw);
    expect(parsed?.items[0]).toEqual({ type: "PRODUCT", id: "wine-1", quantity: 1 });
  });
});
