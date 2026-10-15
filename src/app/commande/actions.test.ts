import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Focused unit coverage for the `DEMO_MODE` guard in
 * `submitCheckoutAction()` (DEMO-001-F) — not a full test suite for
 * checkout itself (no such suite exists yet for this file). Everything
 * that would touch a real database/provider is mocked; the only thing
 * under test is: does `DEMO_MODE=true` block order creation before any
 * of that is ever reached, and does any other value/absence leave the
 * normal path untouched.
 *
 * `@/infrastructure/database/client` imports a real `db` at module
 * load (asserts `DATABASE_URL` eagerly) — mocked here purely so the
 * module graph loads in a DB-less unit-test process, same precedent as
 * `produits/actions.test.ts`/`bundles/actions.test.ts`.
 */
vi.mock("@/infrastructure/database/client", () => ({ db: {} }));

const mockCreateOrder = vi.hoisted(() => vi.fn());
const mockOrderExistsForIdempotencyKey = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/orders/create-order", () => ({
  createOrder: mockCreateOrder,
  orderExistsForIdempotencyKey: mockOrderExistsForIdempotencyKey,
}));

const mockInitiateOnlinePayment = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/payments/online-payments", () => ({
  initiateOnlinePayment: mockInitiateOnlinePayment,
}));

const mockGetCurrentRateLimitIdentity = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/rate-limit/current-identity", () => ({
  getCurrentRateLimitIdentity: mockGetCurrentRateLimitIdentity,
}));

const mockConsumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/rate-limit/rate-limit", () => ({
  consumeRateLimit: mockConsumeRateLimit,
}));

const { submitCheckoutAction } = await import("./actions");

function validPayload() {
  return {
    customerFirstName: "Anne",
    customerLastName: "Test",
    customerAddress: "Rue de Test 1",
    customerPostalCode: "1000",
    customerCity: "Lausanne",
    customerEmail: "anne@example.test",
    customerPhone: "+41791234567",
    deliveryNote: "",
    // CORR-003: wines are sold only in lots of 3 — quantity must be a
    // multiple of 3, or the shared Zod schema rejects the payload
    // before this test's DEMO_MODE guard is even what's being exercised.
    items: [{ type: "PRODUCT" as const, id: "11111111-1111-1111-1111-111111111111", quantity: 3 }],
    campaignId: "22222222-2222-2222-2222-222222222222",
    sellerId: null,
    idempotencyKey: randomUUID(),
    paymentMethod: "SELLER" as const,
  };
}

const ORIGINAL_DEMO_MODE = process.env.DEMO_MODE;

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderExistsForIdempotencyKey.mockResolvedValue(false);
  mockGetCurrentRateLimitIdentity.mockResolvedValue("test-identity");
  mockConsumeRateLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  if (ORIGINAL_DEMO_MODE === undefined) {
    delete process.env.DEMO_MODE;
  } else {
    process.env.DEMO_MODE = ORIGINAL_DEMO_MODE;
  }
});

describe("submitCheckoutAction — DEMO_MODE guard (DEMO-001-F)", () => {
  it("DEMO_MODE=true blocks order creation before any database/provider access", async () => {
    process.env.DEMO_MODE = "true";

    const result = await submitCheckoutAction(validPayload());

    expect(result).toEqual({
      status: "cart-error",
      message: "Version de démonstration — aucune commande ne peut être validée.",
    });
    expect(mockOrderExistsForIdempotencyKey).not.toHaveBeenCalled();
    expect(mockGetCurrentRateLimitIdentity).not.toHaveBeenCalled();
    expect(mockConsumeRateLimit).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  function createdOrderResult() {
    return {
      status: "created" as const,
      order: {
        orderNumber: "ECM-2026-0001",
        customerFirstName: "Anne",
        customerLastName: "Test",
        sellerId: null,
        totalAmount: 1800,
      },
      items: [],
    };
  }

  it("DEMO_MODE absent preserves normal order-creation behavior", async () => {
    delete process.env.DEMO_MODE;
    mockCreateOrder.mockResolvedValue(createdOrderResult());

    const result = await submitCheckoutAction(validPayload());

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
  });

  it('DEMO_MODE set to a value other than the literal string "true" preserves normal behavior', async () => {
    process.env.DEMO_MODE = "false";
    mockCreateOrder.mockResolvedValue(createdOrderResult());

    const result = await submitCheckoutAction(validPayload());

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
  });
});
