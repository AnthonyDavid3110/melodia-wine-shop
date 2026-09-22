import { describe, expect, it } from "vitest";
import {
  canConfirmOnlinePaymentSuccess,
  canInitiateOnlinePayment,
  canReconcileOnlinePayment,
  canRetryOnlinePayment,
  hasActivePaymentAttempt,
  isActivePaymentAttempt,
} from "./payment-guards";

describe("canInitiateOnlinePayment", () => {
  it("allows a NEW/PENDING order", () => {
    expect(canInitiateOnlinePayment({ status: "NEW", customerPaymentStatus: "PENDING" })).toBe(
      true,
    );
  });

  it("blocks once already CONFIRMED", () => {
    expect(
      canInitiateOnlinePayment({ status: "CONFIRMED", customerPaymentStatus: "PENDING" }),
    ).toBe(false);
  });

  it("blocks once already PAID even if status somehow reads NEW", () => {
    expect(canInitiateOnlinePayment({ status: "NEW", customerPaymentStatus: "PAID" })).toBe(false);
  });

  it("blocks a CANCELLED order", () => {
    expect(
      canInitiateOnlinePayment({ status: "CANCELLED", customerPaymentStatus: "PENDING" }),
    ).toBe(false);
  });
});

describe("isActivePaymentAttempt / hasActivePaymentAttempt", () => {
  it("treats PENDING and PROCESSING as active", () => {
    expect(isActivePaymentAttempt({ status: "PENDING" })).toBe(true);
    expect(isActivePaymentAttempt({ status: "PROCESSING" })).toBe(true);
  });

  it("treats terminal states as not active", () => {
    expect(isActivePaymentAttempt({ status: "SUCCEEDED" })).toBe(false);
    expect(isActivePaymentAttempt({ status: "FAILED" })).toBe(false);
    expect(isActivePaymentAttempt({ status: "CANCELLED" })).toBe(false);
  });

  it("hasActivePaymentAttempt is true if any attempt is active", () => {
    expect(hasActivePaymentAttempt([{ status: "FAILED" }, { status: "PROCESSING" }])).toBe(true);
    expect(hasActivePaymentAttempt([{ status: "FAILED" }, { status: "CANCELLED" }])).toBe(false);
    expect(hasActivePaymentAttempt([])).toBe(false);
  });
});

describe("canRetryOnlinePayment", () => {
  const order = { status: "NEW", customerPaymentStatus: "PENDING" };

  it("allows retry when the order is eligible and no attempt is active", () => {
    expect(canRetryOnlinePayment(order, [{ status: "FAILED" }])).toBe(true);
  });

  it("blocks retry while an attempt is already active", () => {
    expect(canRetryOnlinePayment(order, [{ status: "PENDING" }])).toBe(false);
  });

  it("blocks retry once the order is no longer eligible", () => {
    expect(
      canRetryOnlinePayment({ status: "CONFIRMED", customerPaymentStatus: "PAID" }, [
        { status: "SUCCEEDED" },
      ]),
    ).toBe(false);
  });

  it("allows a fresh retry after a CANCELLED attempt — the terminal row is never reused", () => {
    expect(canRetryOnlinePayment(order, [{ status: "CANCELLED" }])).toBe(true);
  });
});

describe("canConfirmOnlinePaymentSuccess", () => {
  it("allows confirming a still-active attempt on a still-NEW order", () => {
    expect(
      canConfirmOnlinePaymentSuccess(
        { status: "NEW", customerPaymentStatus: "PENDING" },
        { status: "PENDING" },
      ),
    ).toBe(true);
  });

  it("blocks re-confirming an already-terminal attempt", () => {
    expect(
      canConfirmOnlinePaymentSuccess(
        { status: "NEW", customerPaymentStatus: "PENDING" },
        { status: "SUCCEEDED" },
      ),
    ).toBe(false);
  });

  it("blocks once the order is no longer NEW", () => {
    expect(
      canConfirmOnlinePaymentSuccess(
        { status: "CONFIRMED", customerPaymentStatus: "PAID" },
        { status: "PENDING" },
      ),
    ).toBe(false);
  });
});

describe("canReconcileOnlinePayment", () => {
  const order = { status: "NEW", customerPaymentStatus: "PENDING" };

  it("allows reconciliation when the order is eligible and a SAFERPAY attempt is active", () => {
    expect(canReconcileOnlinePayment(order, [{ status: "PENDING", provider: "SAFERPAY" }])).toBe(
      true,
    );
  });

  it("blocks an offline SELLER order — no SAFERPAY attempt exists", () => {
    expect(canReconcileOnlinePayment(order, [{ status: "PENDING", provider: "OFFLINE" }])).toBe(
      false,
    );
  });

  it("blocks an order with no payment attempts at all", () => {
    expect(canReconcileOnlinePayment(order, [])).toBe(false);
  });

  it("blocks once the order is no longer NEW/PENDING (already paid/confirmed)", () => {
    expect(
      canReconcileOnlinePayment({ status: "CONFIRMED", customerPaymentStatus: "PAID" }, [
        { status: "SUCCEEDED", provider: "SAFERPAY" },
      ]),
    ).toBe(false);
  });

  it("blocks when every SAFERPAY attempt is already terminal FAILED/CANCELLED — nothing left to reconcile", () => {
    expect(
      canReconcileOnlinePayment(order, [
        { status: "FAILED", provider: "SAFERPAY" },
        { status: "CANCELLED", provider: "SAFERPAY" },
      ]),
    ).toBe(false);
  });
});
