import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fully mocked at the module boundary (never the real
 * `online-payments.ts`/`orders.ts`, which import the database client
 * and would require a live DB connection just to load) — this is a
 * fast unit test of the route's HTTP-response-mapping logic only, not
 * a re-test of the reconciliation logic itself (already covered by
 * `online-payments.db.test.ts`).
 */
vi.mock("@/infrastructure/payments/online-payments", () => {
  class PaymentAttemptNotFoundError extends Error {}
  class NoReconcilablePaymentAttemptError extends Error {}
  class MultipleUnresolvedPaymentAttemptsError extends Error {}
  return {
    confirmOnlinePayment: vi.fn(),
    PaymentAttemptNotFoundError,
    NoReconcilablePaymentAttemptError,
    MultipleUnresolvedPaymentAttemptsError,
  };
});

vi.mock("@/infrastructure/orders/orders", () => {
  class OrderNotFoundError extends Error {}
  return { OrderNotFoundError };
});

const {
  confirmOnlinePayment,
  PaymentAttemptNotFoundError,
  NoReconcilablePaymentAttemptError,
  MultipleUnresolvedPaymentAttemptsError,
} = await import("@/infrastructure/payments/online-payments");
const { OrderNotFoundError } = await import("@/infrastructure/orders/orders");
const { SaferpayConfigurationError } = await import("@/infrastructure/payments/saferpay-client");
const { GET } = await import("./route");

const VALID_TOKEN = "a".repeat(43);

function callRoute(token: string) {
  return GET(new Request("http://localhost/api/payments/saferpay/notify/" + token), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  vi.mocked(confirmOnlinePayment).mockReset();
});

describe("GET /api/payments/saferpay/notify/[token]", () => {
  it("returns 200 for a successfully reconciled payment", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "SUCCEEDED",
      orderNumber: "ECM-2026-0001",
    });
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(200);
    expect(confirmOnlinePayment).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("returns 200 for an already-terminal FAILED payment", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "FAILED",
      orderNumber: "ECM-2026-0001",
    });
    expect((await callRoute(VALID_TOKEN)).status).toBe(200);
  });

  it("returns 200 for an already-terminal CANCELLED payment", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "CANCELLED",
      orderNumber: "ECM-2026-0001",
    });
    expect((await callRoute(VALID_TOKEN)).status).toBe(200);
  });

  it("returns 200 for a duplicate callback (same as a normal repeat call)", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "SUCCEEDED",
      orderNumber: "ECM-2026-0001",
    });
    await callRoute(VALID_TOKEN);
    const second = await callRoute(VALID_TOKEN);
    expect(second.status).toBe(200);
    expect(confirmOnlinePayment).toHaveBeenCalledTimes(2);
  });

  it("returns 200 for an unknown token, leaking no information about token validity", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new PaymentAttemptNotFoundError());
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toMatch(/introuvable|not found|unknown/i);
  });

  it("returns 200 when the resolved Order cannot be found", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new OrderNotFoundError("x"));
    expect((await callRoute(VALID_TOKEN)).status).toBe(200);
  });

  it("returns 200 when the admin-reconciliation errors surface here defensively", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new NoReconcilablePaymentAttemptError());
    expect((await callRoute(VALID_TOKEN)).status).toBe(200);
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new MultipleUnresolvedPaymentAttemptsError());
    expect((await callRoute(VALID_TOKEN)).status).toBe(200);
  });

  it("returns 200 for a malformed token WITHOUT calling confirmOnlinePayment at all", async () => {
    const response = await callRoute("not-a-real-token!!");
    expect(response.status).toBe(200);
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });

  it("returns 200 for an empty token WITHOUT calling confirmOnlinePayment", async () => {
    const response = await callRoute("");
    expect(response.status).toBe(200);
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });

  it("returns 503 when Assert/Capture failed transiently (transport error) — never FAILED", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "PROCESSING",
      orderNumber: "ECM-2026-0001",
      transient: true,
    });
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(503);
  });

  it("returns 200 for a still-PROCESSING result that is NOT transient (e.g. capture genuinely pending)", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "PROCESSING",
      orderNumber: "ECM-2026-0001",
    });
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(200);
  });

  it("returns 200 for a durably recorded financial anomaly (non-transient)", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "PROCESSING",
      orderNumber: "ECM-2026-0001",
      anomaly: true,
    });
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(200);
  });

  it("returns 503 on a configuration failure, never leaking configuration detail", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new SaferpayConfigurationError());
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toMatch(/SAFERPAY_|env|config/i);
  });

  it("returns 503 on an unexpected/DB failure, never leaking diagnostic detail", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new Error("connection terminated"));
    const response = await callRoute(VALID_TOKEN);
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toMatch(/connection terminated|stack|Error:/i);
  });

  it("never includes the order number, token, or any sensitive detail in the response body", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({
      status: "SUCCEEDED",
      orderNumber: "ECM-2026-0042",
    });
    const response = await callRoute(VALID_TOKEN);
    const body = await response.text();
    expect(body).not.toContain("ECM-2026-0042");
    expect(body).not.toContain(VALID_TOKEN);
    expect(body.length).toBeLessThan(50);
  });
});
