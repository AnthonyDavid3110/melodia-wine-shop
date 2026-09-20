import { describe, expect, it } from "vitest";
import { orderCreationInputSchema } from "./order-input-schema";

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
    items: [{ type: "PRODUCT", id: "wine-1", quantity: 2 }],
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
});
