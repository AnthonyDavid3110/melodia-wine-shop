import { describe, expect, it } from "vitest";
import { normalizeSaferpayOutcome } from "./normalize-saferpay-outcome";

describe("normalizeSaferpayOutcome", () => {
  const successDetails = {
    transactionId: "txn_123",
    amountValue: "1800",
    currencyCode: "CHF",
    paymentMethod: "TWINT",
  };

  it("maps AUTHORIZED/CAPTURED success to SUCCEEDED", () => {
    expect(
      normalizeSaferpayOutcome({
        kind: "success",
        providerStatus: "AUTHORIZED",
        ...successDetails,
      }),
    ).toEqual({ status: "SUCCEEDED" });
    expect(
      normalizeSaferpayOutcome({ kind: "success", providerStatus: "CAPTURED", ...successDetails }),
    ).toEqual({ status: "SUCCEEDED" });
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
