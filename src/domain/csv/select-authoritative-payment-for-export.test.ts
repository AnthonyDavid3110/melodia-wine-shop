import { describe, expect, it } from "vitest";
import {
  selectAuthoritativePaymentForExport,
  type PaymentAttemptForExportSelection,
} from "./select-authoritative-payment-for-export";

function payment(
  overrides: Partial<PaymentAttemptForExportSelection> & { id: string },
): PaymentAttemptForExportSelection {
  return {
    method: "SELLER",
    provider: "OFFLINE",
    providerPaymentId: null,
    status: "PENDING",
    paidAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("selectAuthoritativePaymentForExport", () => {
  it("returns null when no payment exists", () => {
    expect(selectAuthoritativePaymentForExport([])).toBeNull();
  });

  it("selects the pending SELLER payment when it is the only one", () => {
    const seller = payment({ id: "p1", method: "SELLER", status: "PENDING" });
    expect(selectAuthoritativePaymentForExport([seller])).toBe(seller);
  });

  it("selects the SUCCEEDED SELLER payment (marked received)", () => {
    const seller = payment({
      id: "p1",
      method: "SELLER",
      status: "SUCCEEDED",
      paidAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect(selectAuthoritativePaymentForExport([seller])).toBe(seller);
  });

  it("selects a single pending/failed online attempt", () => {
    const attempt = payment({ id: "p1", method: "TWINT", provider: "SAFERPAY", status: "FAILED" });
    expect(selectAuthoritativePaymentForExport([attempt])).toBe(attempt);
  });

  it("selects the SUCCEEDED attempt over an earlier FAILED attempt", () => {
    const failed = payment({
      id: "p1",
      method: "TWINT",
      provider: "SAFERPAY",
      status: "FAILED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const succeeded = payment({
      id: "p2",
      method: "TWINT",
      provider: "SAFERPAY",
      status: "SUCCEEDED",
      paidAt: new Date("2026-01-02T00:00:00Z"),
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    expect(selectAuthoritativePaymentForExport([failed, succeeded])).toBe(succeeded);
  });

  it("selects the most recent of multiple unsuccessful online attempts by createdAt", () => {
    const first = payment({
      id: "p1",
      method: "TWINT",
      provider: "SAFERPAY",
      status: "FAILED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const second = payment({
      id: "p2",
      method: "CARD",
      provider: "SAFERPAY",
      status: "CANCELLED",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    const third = payment({
      id: "p3",
      method: "TWINT",
      provider: "SAFERPAY",
      status: "FAILED",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    });
    expect(selectAuthoritativePaymentForExport([first, second, third])).toBe(third);
  });

  it("breaks an equal-createdAt tie deterministically by id, documented as a technical tie-break only", () => {
    const sameTime = new Date("2026-01-01T00:00:00Z");
    const a = payment({ id: "aaaa", status: "FAILED", createdAt: sameTime });
    const b = payment({ id: "bbbb", status: "FAILED", createdAt: sameTime });
    const first = selectAuthoritativePaymentForExport([a, b]);
    const second = selectAuthoritativePaymentForExport([b, a]);
    // Order-of-input-independent and stable across repeated calls — the
    // exact winner (the lexicographically larger id, per the "latest
    // first" comparator) is not itself a chronology claim.
    expect(first).toBe(b);
    expect(second).toBe(b);
  });

  it("ignores unsuccessful attempts once a SUCCEEDED payment exists, regardless of order", () => {
    const succeeded = payment({
      id: "p1",
      status: "SUCCEEDED",
      paidAt: new Date("2026-01-01T00:00:00Z"),
    });
    const laterFailedRetryNoise = payment({
      id: "p2",
      status: "FAILED",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    expect(selectAuthoritativePaymentForExport([succeeded, laterFailedRetryNoise])).toBe(succeeded);
    expect(selectAuthoritativePaymentForExport([laterFailedRetryNoise, succeeded])).toBe(succeeded);
  });
});
