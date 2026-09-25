import { describe, expect, it } from "vitest";
import { money } from "../money";
import { buildPaymentKpis, type DashboardOrderInput } from "./build-payment-kpis";

function order(fields: Partial<DashboardOrderInput>): DashboardOrderInput {
  return {
    status: "CONFIRMED",
    totalAmount: money(0),
    customerPaymentStatus: "PENDING",
    sellerSettlementStatus: "NOT_APPLICABLE",
    sellerId: "seller-1",
    paymentMethod: null,
    ...fields,
  };
}

describe("buildPaymentKpis", () => {
  it("counts online paid as TWINT/CARD orders already PAID", () => {
    const kpis = buildPaymentKpis([
      order({ totalAmount: money(20_00), paymentMethod: "TWINT", customerPaymentStatus: "PAID" }),
      order({ totalAmount: money(30_00), paymentMethod: "CARD", customerPaymentStatus: "PAID" }),
      // Not yet paid online: excluded from onlinePaid.
      order({ totalAmount: money(99_00), paymentMethod: "CARD", customerPaymentStatus: "PENDING" }),
    ]);
    expect(kpis.onlinePaid).toBe(50_00);
  });

  it("counts seller-payment sales regardless of paid status", () => {
    const kpis = buildPaymentKpis([
      order({
        totalAmount: money(40_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PAID",
        sellerSettlementStatus: "SETTLED",
      }),
      order({
        totalAmount: money(15_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PENDING",
      }),
    ]);
    expect(kpis.sellerPayment).toBe(55_00);
  });

  it("keeps outstanding customer payments and outstanding seller settlements distinct", () => {
    const kpis = buildPaymentKpis([
      // Customer hasn't paid the seller yet.
      order({
        totalAmount: money(15_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PENDING",
      }),
      // Customer paid the seller, seller hasn't remitted to ECM yet.
      order({
        totalAmount: money(40_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PAID",
        sellerSettlementStatus: "PENDING",
      }),
      // Customer paid, seller already remitted: neither figure.
      order({
        totalAmount: money(12_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PAID",
        sellerSettlementStatus: "SETTLED",
      }),
    ]);
    expect(kpis.outstandingCustomerPayments).toBe(15_00);
    expect(kpis.outstandingSellerSettlements).toBe(40_00);
  });

  it("excludes CANCELLED orders from every figure", () => {
    const kpis = buildPaymentKpis([
      order({
        status: "CANCELLED",
        totalAmount: money(99_00),
        paymentMethod: "SELLER",
        customerPaymentStatus: "PAID",
      }),
    ]);
    expect(kpis).toEqual({
      onlinePaid: 0,
      sellerPayment: 0,
      outstandingCustomerPayments: 0,
      outstandingSellerSettlements: 0,
    });
  });

  it("ignores orders with no payment row yet (paymentMethod: null)", () => {
    const kpis = buildPaymentKpis([order({ totalAmount: money(20_00), paymentMethod: null })]);
    expect(kpis.onlinePaid).toBe(0);
    expect(kpis.sellerPayment).toBe(0);
  });
});
