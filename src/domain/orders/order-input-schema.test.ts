import { describe, expect, it } from "vitest";
import { checkoutInputSchema, orderCreationInputSchema } from "./order-input-schema";

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    customerEmail: "jean@example.ch",
    customerPhone: "079 000 00 00",
    deliveryNote: "",
    items: [{ type: "PRODUCT", id: "wine-1", quantity: 3 }],
    sellerId: null,
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    ...overrides,
  };
}

describe("orderCreationInputSchema", () => {
  it("accepts a complete, valid payload", () => {
    expect(orderCreationInputSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("accepts a payload with no seller (null) and no delivery note", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ sellerId: null, deliveryNote: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it.each(["", "   "])("rejects a blank required field: firstName=%p", (value) => {
    const result = orderCreationInputSchema.safeParse(validPayload({ customerFirstName: value }));
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ customerEmail: "not-an-email" }),
    );
    expect(result.success).toBe(false);
  });

  it("does NOT enforce a Swiss-specific postal code format — any non-empty string is accepted at this layer", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ customerPostalCode: "SW1A 1AA" }),
    );
    expect(result.success).toBe(true);
  });

  it("does NOT enforce a Swiss-specific phone format", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ customerPhone: "+1 415 555 0100" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = orderCreationInputSchema.safeParse(validPayload({ items: [] }));
    expect(result.success).toBe(false);
  });

  it.each([0, -1, 1.5, 1000])("rejects an invalid item quantity: %p", (quantity) => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ items: [{ type: "PRODUCT", id: "wine-1", quantity }] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts the declared maximum item quantity (999) — Gate 14E boundary confirmation", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ items: [{ type: "PRODUCT", id: "wine-1", quantity: 999 }] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a malformed idempotency key (not a UUID)", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ idempotencyKey: "not-a-uuid" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown item type", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ items: [{ type: "GIFT_CARD", id: "x", quantity: 1 }] }),
    );
    expect(result.success).toBe(false);
  });

  // CORR-003 — wines are sold only in lots of 3 identical bottles.
  it.each([1, 2, 4, 5, 7, 8])(
    "rejects a PRODUCT line whose quantity isn't a multiple of 3: %p",
    (quantity) => {
      const result = orderCreationInputSchema.safeParse(
        validPayload({ items: [{ type: "PRODUCT", id: "wine-1", quantity }] }),
      );
      expect(result.success).toBe(false);
    },
  );

  it.each([3, 6, 9, 999])(
    "accepts a PRODUCT line whose quantity is a multiple of 3: %p",
    (quantity) => {
      const result = orderCreationInputSchema.safeParse(
        validPayload({ items: [{ type: "PRODUCT", id: "wine-1", quantity }] }),
      );
      expect(result.success).toBe(true);
    },
  );

  it("never applies the lot-of-3 rule to a BUNDLE line (the Discovery Box is unaffected)", () => {
    const result = orderCreationInputSchema.safeParse(
      validPayload({ items: [{ type: "BUNDLE", id: "discovery-box", quantity: 1 }] }),
    );
    expect(result.success).toBe(true);
  });
});

// CORR-004 — the public checkout must require an explicit seller decision;
// `orderCreationInputSchema` itself (used unchanged by the admin manual
// order form) has no opinion on this, only `checkoutInputSchema` does.
describe("checkoutInputSchema", () => {
  it("accepts an explicit 'known seller' decision with a matching sellerId", () => {
    const result = checkoutInputSchema.safeParse(
      validPayload({ sellerId: "seller-1", sellerDecision: "KNOWN" }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts an explicit 'no seller' decision with a null sellerId", () => {
    const result = checkoutInputSchema.safeParse(
      validPayload({ sellerId: null, sellerDecision: "NONE" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing sellerDecision entirely (an untouched field must never pass silently)", () => {
    const payload = validPayload({ sellerId: null });
    const result = checkoutInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.sellerDecision).toBeDefined();
    }
  });

  it("rejects 'KNOWN' without an actual sellerId (combobox opened but nothing picked)", () => {
    const result = checkoutInputSchema.safeParse(
      validPayload({ sellerId: null, sellerDecision: "KNOWN" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.sellerId).toBeDefined();
    }
  });

  it("rejects 'NONE' paired with a non-null sellerId (inconsistent/crafted payload)", () => {
    const result = checkoutInputSchema.safeParse(
      validPayload({ sellerId: "seller-1", sellerDecision: "NONE" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.sellerId).toBeDefined();
    }
  });

  it("rejects an unknown sellerDecision value", () => {
    const result = checkoutInputSchema.safeParse(
      validPayload({ sellerId: null, sellerDecision: "MAYBE" }),
    );
    expect(result.success).toBe(false);
  });
});
