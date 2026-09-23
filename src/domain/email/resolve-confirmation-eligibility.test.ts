import { describe, expect, it } from "vitest";
import {
  confirmationEligibilityReasonLabel,
  resolveOrderConfirmationEligibility,
} from "./resolve-confirmation-eligibility";

describe("resolveOrderConfirmationEligibility", () => {
  it("eligible SELLER_PAYMENT: public SELLER order, CONFIRMED, PENDING", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PENDING" },
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "SELLER" });
  });

  it("eligible SELLER_PAYMENT: MANUAL order, same predicate, no source consulted", () => {
    // resolveOrderConfirmationEligibility never receives `source` at
    // all — this test proves MANUAL and public-checkout SELLER orders
    // are indistinguishable to it, by construction.
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PENDING" },
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "SELLER" });
  });

  it("eligible ONLINE_PAID: succeeded TWINT payment", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PAID" },
      [{ provider: "SAFERPAY", method: "TWINT", status: "SUCCEEDED" }],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "TWINT" });
  });

  it("eligible ONLINE_PAID: succeeded CARD payment reports CARD, not TWINT", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PAID" },
      [{ provider: "SAFERPAY", method: "CARD", status: "SUCCEEDED" }],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "CARD" });
  });

  it("ineligible: SELLER order already marked PAID", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PAID" },
      [{ provider: "OFFLINE", method: "SELLER", status: "SUCCEEDED" }],
    );
    expect(result).toEqual({ eligible: false, reason: "seller-payment-not-pending" });
  });

  it("ineligible: SELLER order marked REFUNDED (defensive — not currently reachable in the app)", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "REFUNDED" },
      [{ provider: "OFFLINE", method: "SELLER", status: "SUCCEEDED" }],
    );
    expect(result).toEqual({ eligible: false, reason: "seller-payment-not-pending" });
  });

  it("ineligible: ONLINE order still NEW/pending (no succeeded payment yet)", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "NEW", customerPaymentStatus: "PENDING" },
      [{ provider: "SAFERPAY", method: "TWINT", status: "PENDING" }],
    );
    expect(result).toEqual({ eligible: false, reason: "online-payment-not-completed" });
  });

  it("ineligible: ONLINE order with a FAILED payment attempt", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "NEW", customerPaymentStatus: "PENDING" },
      [{ provider: "SAFERPAY", method: "TWINT", status: "FAILED" }],
    );
    expect(result).toEqual({ eligible: false, reason: "online-payment-not-completed" });
  });

  it("ineligible: ONLINE order with a CANCELLED payment attempt", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "NEW", customerPaymentStatus: "PENDING" },
      [{ provider: "SAFERPAY", method: "TWINT", status: "CANCELLED" }],
    );
    expect(result).toEqual({ eligible: false, reason: "online-payment-not-completed" });
  });

  it("eligible ONLINE_PAID even with an earlier FAILED attempt on the same order (retry succeeded)", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CONFIRMED", customerPaymentStatus: "PAID" },
      [
        { provider: "SAFERPAY", method: "TWINT", status: "FAILED" },
        { provider: "SAFERPAY", method: "CARD", status: "SUCCEEDED" },
      ],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "CARD" });
  });

  it("ineligible: CANCELLED order (SELLER payment, otherwise would be eligible)", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CANCELLED", customerPaymentStatus: "PENDING" },
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
    );
    expect(result).toEqual({ eligible: false, reason: "order-cancelled" });
  });

  it("ineligible: CANCELLED order takes priority even if a SAFERPAY payment row exists", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "CANCELLED", customerPaymentStatus: "PENDING" },
      [{ provider: "SAFERPAY", method: "TWINT", status: "SUCCEEDED" }],
    );
    expect(result).toEqual({ eligible: false, reason: "order-cancelled" });
  });

  it("fulfilment progression alone (PREPARED/HANDED_TO_SELLER/DELIVERED) never removes SELLER_PAYMENT eligibility", () => {
    for (const status of ["PREPARED", "HANDED_TO_SELLER", "DELIVERED"]) {
      const result = resolveOrderConfirmationEligibility(
        { status, customerPaymentStatus: "PENDING" },
        [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
      );
      expect(result).toEqual({ eligible: true, paymentMethod: "SELLER" });
    }
  });

  it("fulfilment progression alone never removes ONLINE_PAID eligibility", () => {
    for (const status of ["PREPARED", "HANDED_TO_SELLER", "DELIVERED"]) {
      const result = resolveOrderConfirmationEligibility(
        { status, customerPaymentStatus: "PAID" },
        [{ provider: "SAFERPAY", method: "TWINT", status: "SUCCEEDED" }],
      );
      expect(result).toEqual({ eligible: true, paymentMethod: "TWINT" });
    }
  });

  it("a DELIVERED order that is still customer-unpaid remains eligible (BR-PAY-005's 'DELIVERED + PENDING' is a valid state)", () => {
    const result = resolveOrderConfirmationEligibility(
      { status: "DELIVERED", customerPaymentStatus: "PENDING" },
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
    );
    expect(result).toEqual({ eligible: true, paymentMethod: "SELLER" });
  });
});

describe("confirmationEligibilityReasonLabel", () => {
  it("returns a distinct French message for each reason", () => {
    const reasons = [
      "order-cancelled",
      "online-payment-not-completed",
      "seller-payment-not-pending",
    ] as const;
    const labels = reasons.map(confirmationEligibilityReasonLabel);
    expect(new Set(labels).size).toBe(reasons.length);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
