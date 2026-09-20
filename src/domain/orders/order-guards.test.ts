import { describe, expect, it } from "vitest";
import { canCancelOrder, canMarkCustomerPaymentReceived, canReassignSeller } from "./order-guards";

describe("canCancelOrder", () => {
  const base = {
    status: "CONFIRMED",
    customerPaymentStatus: "PENDING",
    sellerSettlementStatus: "PENDING",
  };

  it("allows cancelling a PENDING/PENDING order", () => {
    expect(canCancelOrder(base)).toBe(true);
  });

  it("blocks cancelling an already-cancelled order", () => {
    expect(canCancelOrder({ ...base, status: "CANCELLED" })).toBe(false);
  });

  it("blocks cancelling once the customer has paid", () => {
    expect(canCancelOrder({ ...base, customerPaymentStatus: "PAID" })).toBe(false);
  });

  it("blocks cancelling once the seller has settled, even if customer payment somehow reads PENDING", () => {
    expect(canCancelOrder({ ...base, sellerSettlementStatus: "SETTLED" })).toBe(false);
  });

  it("blocks cancelling a PAID + SETTLED order", () => {
    expect(
      canCancelOrder({ ...base, customerPaymentStatus: "PAID", sellerSettlementStatus: "SETTLED" }),
    ).toBe(false);
  });
});

describe("canReassignSeller", () => {
  it("allows reassignment while settlement is PENDING", () => {
    expect(canReassignSeller({ sellerSettlementStatus: "PENDING" })).toBe(true);
  });

  it("allows reassignment for NOT_APPLICABLE (future online-paid orders)", () => {
    expect(canReassignSeller({ sellerSettlementStatus: "NOT_APPLICABLE" })).toBe(true);
  });

  it("blocks reassignment once SETTLED", () => {
    expect(canReassignSeller({ sellerSettlementStatus: "SETTLED" })).toBe(false);
  });
});

describe("canMarkCustomerPaymentReceived", () => {
  it("allows marking a PENDING, non-cancelled order as paid", () => {
    expect(
      canMarkCustomerPaymentReceived({ status: "CONFIRMED", customerPaymentStatus: "PENDING" }),
    ).toBe(true);
  });

  it("blocks marking an already-PAID order again", () => {
    expect(
      canMarkCustomerPaymentReceived({ status: "CONFIRMED", customerPaymentStatus: "PAID" }),
    ).toBe(false);
  });

  it("blocks marking a cancelled order", () => {
    expect(
      canMarkCustomerPaymentReceived({ status: "CANCELLED", customerPaymentStatus: "PENDING" }),
    ).toBe(false);
  });
});
