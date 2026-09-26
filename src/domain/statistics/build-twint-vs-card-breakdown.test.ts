import { describe, expect, it } from "vitest";
import { money } from "../money";
import type { DashboardOrderInput } from "../dashboard/build-payment-kpis";
import { buildTwintVsCardBreakdown } from "./build-twint-vs-card-breakdown";

function order(fields: Partial<DashboardOrderInput>): DashboardOrderInput {
  return {
    status: "CONFIRMED",
    totalAmount: money(0),
    customerPaymentStatus: "PENDING",
    sellerSettlementStatus: "NOT_APPLICABLE",
    sellerId: null,
    paymentMethod: null,
    ...fields,
  };
}

describe("buildTwintVsCardBreakdown", () => {
  it("splits authoritative-paid online orders by method", () => {
    const breakdown = buildTwintVsCardBreakdown([
      order({ totalAmount: money(20_00), paymentMethod: "TWINT", customerPaymentStatus: "PAID" }),
      order({ totalAmount: money(30_00), paymentMethod: "TWINT", customerPaymentStatus: "PAID" }),
      order({ totalAmount: money(50_00), paymentMethod: "CARD", customerPaymentStatus: "PAID" }),
    ]);
    expect(breakdown).toEqual({ twint: 50_00, card: 50_00 });
  });

  it("excludes SELLER-method orders from both buckets", () => {
    const breakdown = buildTwintVsCardBreakdown([
      order({ totalAmount: money(99_00), paymentMethod: "SELLER", customerPaymentStatus: "PAID" }),
    ]);
    expect(breakdown).toEqual({ twint: 0, card: 0 });
  });

  it("excludes orders not yet authoritatively paid (never counts a failed/pending attempt)", () => {
    const breakdown = buildTwintVsCardBreakdown([
      order({
        totalAmount: money(99_00),
        paymentMethod: "TWINT",
        customerPaymentStatus: "PENDING",
      }),
    ]);
    expect(breakdown).toEqual({ twint: 0, card: 0 });
  });

  it("excludes CANCELLED orders", () => {
    const breakdown = buildTwintVsCardBreakdown([
      order({
        status: "CANCELLED",
        totalAmount: money(99_00),
        paymentMethod: "CARD",
        customerPaymentStatus: "PAID",
      }),
    ]);
    expect(breakdown).toEqual({ twint: 0, card: 0 });
  });

  it("returns zeros for no orders", () => {
    expect(buildTwintVsCardBreakdown([])).toEqual({ twint: 0, card: 0 });
  });
});
