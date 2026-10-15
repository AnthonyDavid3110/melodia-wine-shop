import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Focused unit coverage for `submitCheckoutAction()`: the `DEMO_MODE`
 * guard (DEMO-001-F, demo-showcase only) and the CORR-004 mandatory
 * seller-decision guard. Not a full test suite for checkout itself.
 * Everything that would touch a real database/provider is mocked; the
 * only things under test are: does `DEMO_MODE=true` block order
 * creation before any of that is ever reached (and does any other
 * value/absence leave the normal path untouched), and does the server
 * reject a payload with no explicit seller decision (or an incoherent
 * one) while accepting a valid explicit decision either way.
 *
 * `@/infrastructure/database/client` imports a real `db` at module
 * load (asserts `DATABASE_URL` eagerly) — mocked here purely so the
 * module graph loads in a DB-less unit-test process, same precedent as
 * `produits/actions.test.ts`/`bundles/actions.test.ts`. `select()` needs
 * a real chain (not just `{}`) since the "known seller" success path
 * looks the seller up by id to build `sellerName`.
 */
const mockSellerRow = vi.hoisted(() => ({
  firstName: "Settlement",
  lastName: "Seller",
  id: "seller-1",
}));
vi.mock("@/infrastructure/database/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([mockSellerRow]),
      }),
    }),
  },
}));

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

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
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
    // before whatever this test actually means to exercise.
    items: [{ type: "PRODUCT" as const, id: "11111111-1111-1111-1111-111111111111", quantity: 3 }],
    campaignId: "22222222-2222-2222-2222-222222222222",
    sellerId: null,
    // CORR-004: `checkoutInputSchema` requires this field — defaults to
    // the "no seller" decision so DEMO_MODE-focused tests below (which
    // don't care about seller selection) still parse successfully.
    sellerDecision: "NONE" as const,
    idempotencyKey: randomUUID(),
    paymentMethod: "SELLER" as const,
    ...overrides,
  };
}

function createdOrderResult(sellerId: string | null = null) {
  return {
    status: "created" as const,
    order: {
      orderNumber: "ECM-2026-0001",
      customerFirstName: "Anne",
      customerLastName: "Test",
      sellerId,
      totalAmount: 1800,
    },
    items: [],
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

describe("submitCheckoutAction — mandatory seller decision (CORR-004)", () => {
  it("rejects a payload with no sellerDecision at all — no order is ever created", async () => {
    const payload = validPayload({ sellerId: null });
    delete (payload as Record<string, unknown>).sellerDecision;
    const result = await submitCheckoutAction(payload);

    expect(result.status).toBe("validation-error");
    if (result.status === "validation-error") {
      expect(result.fieldErrors.sellerDecision).toBeDefined();
    }
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(mockOrderExistsForIdempotencyKey).not.toHaveBeenCalled();
  });

  it("rejects 'KNOWN' without an actual sellerId — no order is ever created", async () => {
    const result = await submitCheckoutAction(
      validPayload({ sellerId: null, sellerDecision: "KNOWN" }),
    );

    expect(result.status).toBe("validation-error");
    if (result.status === "validation-error") {
      expect(result.fieldErrors.sellerId).toBeDefined();
    }
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("accepts an explicit known seller and proceeds to order creation", async () => {
    mockCreateOrder.mockResolvedValue(createdOrderResult("seller-1"));

    const result = await submitCheckoutAction(
      validPayload({ sellerId: "seller-1", sellerDecision: "KNOWN" }),
    );

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
  });

  it("accepts an explicit 'no seller' decision and proceeds to order creation", async () => {
    mockCreateOrder.mockResolvedValue(createdOrderResult(null));

    const result = await submitCheckoutAction(
      validPayload({ sellerId: null, sellerDecision: "NONE" }),
    );

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
  });
});
