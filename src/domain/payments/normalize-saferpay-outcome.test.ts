import { describe, expect, it } from "vitest";
import {
  normalizeSaferpayCaptureOutcome,
  normalizeSaferpayOutcome,
} from "./normalize-saferpay-outcome";

describe("normalizeSaferpayOutcome", () => {
  const successDetails = {
    transactionId: "txn_123",
    amountValue: "1800",
    currencyCode: "CHF",
    paymentMethod: "TWINT",
  };

  it("maps CAPTURED success to SUCCEEDED — financially final", () => {
    expect(
      normalizeSaferpayOutcome({ kind: "success", providerStatus: "CAPTURED", ...successDetails }),
    ).toEqual({ status: "SUCCEEDED" });
  });

  it("maps AUTHORIZED to REQUIRES_CAPTURE — NOT success (Gate 10C-A: AUTHORIZED alone is not financially final)", () => {
    expect(
      normalizeSaferpayOutcome({
        kind: "success",
        providerStatus: "AUTHORIZED",
        ...successDetails,
      }),
    ).toEqual({ status: "REQUIRES_CAPTURE" });
  });

  it("maps a payer-aborted transaction to CANCELLED, never FAILED", () => {
    expect(normalizeSaferpayOutcome({ kind: "aborted" })).toEqual({ status: "CANCELLED" });
  });

  it("maps a processor decline to FAILED", () => {
    expect(
      normalizeSaferpayOutcome({
        kind: "declined",
        errorName: "TRANSACTION_DECLINED",
        message: "declined",
      }),
    ).toEqual({ status: "FAILED" });
  });

  it("maps a still-pending (Account-to-Account) result to PROCESSING, not a terminal state", () => {
    expect(normalizeSaferpayOutcome({ kind: "pending" })).toEqual({
      status: "PROCESSING",
      anomaly: false,
    });
  });

  it("never maps an unrecognized outcome to SUCCEEDED or a terminal failure — flags it as an anomaly instead", () => {
    const result = normalizeSaferpayOutcome({ kind: "unrecognized", detail: "unexpected shape" });
    expect(result.status).toBe("PROCESSING");
    expect(result).toEqual({ status: "PROCESSING", anomaly: true });
  });
});

describe("normalizeSaferpayCaptureOutcome", () => {
  it("maps a captured response to SUCCEEDED", () => {
    expect(normalizeSaferpayCaptureOutcome({ kind: "captured", captureId: "cap-1" })).toEqual({
      status: "SUCCEEDED",
    });
  });

  it("maps TRANSACTION_ALREADY_CAPTURED to SUCCEEDED, not a failure (Saferpay's own Capture idempotency signal)", () => {
    expect(normalizeSaferpayCaptureOutcome({ kind: "already_captured" })).toEqual({
      status: "SUCCEEDED",
    });
  });

  it("maps a pending capture to PROCESSING, not a terminal state", () => {
    expect(normalizeSaferpayCaptureOutcome({ kind: "pending", captureId: "cap-2" })).toEqual({
      status: "PROCESSING",
      anomaly: false,
    });
  });

  it("never maps an unrecognized capture result to SUCCEEDED or FAILED — flags it as an anomaly instead", () => {
    expect(
      normalizeSaferpayCaptureOutcome({ kind: "unrecognized", detail: "AMOUNT_INVALID" }),
    ).toEqual({ status: "PROCESSING", anomaly: true });
  });
});
