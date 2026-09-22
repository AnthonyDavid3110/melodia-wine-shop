import { describe, expect, it } from "vitest";
import {
  canCancelOrder,
  canHandOrderToSeller,
  canMarkCustomerPaymentReceived,
  canMarkOrderDelivered,
  canPrepareOrder,
  canReassignSeller,
} from "./order-guards";

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

  it("blocks a NEW (online-payment-awaiting) order — no manual mark-paid for Saferpay orders", () => {
    expect(
      canMarkCustomerPaymentReceived({ status: "NEW", customerPaymentStatus: "PENDING" }),
    ).toBe(false);
  });

  it("blocks marking a cancelled order", () => {
    expect(
      canMarkCustomerPaymentReceived({ status: "CANCELLED", customerPaymentStatus: "PENDING" }),
    ).toBe(false);
  });
});

describe("canPrepareOrder", () => {
  it("allows preparing a CONFIRMED order", () => {
    expect(canPrepareOrder({ status: "CONFIRMED" })).toBe(true);
  });

  it("blocks a NEW order (reserved future online-payment state, not treated as CONFIRMED)", () => {
    expect(canPrepareOrder({ status: "NEW" })).toBe(false);
  });

  it("blocks an already-PREPARED order (no re-preparing)", () => {
    expect(canPrepareOrder({ status: "PREPARED" })).toBe(false);
  });

  it("blocks skipping ahead from HANDED_TO_SELLER or DELIVERED", () => {
    expect(canPrepareOrder({ status: "HANDED_TO_SELLER" })).toBe(false);
    expect(canPrepareOrder({ status: "DELIVERED" })).toBe(false);
  });

  it("blocks a CANCELLED order", () => {
    expect(canPrepareOrder({ status: "CANCELLED" })).toBe(false);
  });
});

describe("canHandOrderToSeller", () => {
  it("allows handoff for a PREPARED order with an assigned seller", () => {
    expect(canHandOrderToSeller({ status: "PREPARED", sellerId: "seller-1" })).toBe(true);
  });

  it("blocks handoff for an unassigned PREPARED order", () => {
    expect(canHandOrderToSeller({ status: "PREPARED", sellerId: null })).toBe(false);
  });

  it("blocks handoff from CONFIRMED even with a seller assigned (must be PREPARED first)", () => {
    expect(canHandOrderToSeller({ status: "CONFIRMED", sellerId: "seller-1" })).toBe(false);
  });

  it("blocks handoff from an already-HANDED_TO_SELLER or DELIVERED order", () => {
    expect(canHandOrderToSeller({ status: "HANDED_TO_SELLER", sellerId: "seller-1" })).toBe(false);
    expect(canHandOrderToSeller({ status: "DELIVERED", sellerId: "seller-1" })).toBe(false);
  });
});

describe("canMarkOrderDelivered", () => {
  it("allows delivery for a HANDED_TO_SELLER order", () => {
    expect(canMarkOrderDelivered({ status: "HANDED_TO_SELLER" })).toBe(true);
  });

  it("blocks skipping ahead from CONFIRMED or PREPARED", () => {
    expect(canMarkOrderDelivered({ status: "CONFIRMED" })).toBe(false);
    expect(canMarkOrderDelivered({ status: "PREPARED" })).toBe(false);
  });

  it("blocks an already-DELIVERED order", () => {
    expect(canMarkOrderDelivered({ status: "DELIVERED" })).toBe(false);
  });
});
