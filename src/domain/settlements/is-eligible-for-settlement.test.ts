import { describe, expect, it } from "vitest";
import {
  isEligibleForSettlement,
  type SettlementEligibilityOrderInput,
} from "./is-eligible-for-settlement";

const base: SettlementEligibilityOrderInput = {
  paymentMethod: "SELLER",
  customerPaymentStatus: "PAID",
  sellerId: "seller-1",
  alreadySettled: false,
};

describe("isEligibleForSettlement", () => {
  it("is eligible when all conditions hold", () => {
    expect(isEligibleForSettlement(base)).toBe(true);
  });

  it("is not eligible for online payment methods", () => {
    expect(isEligibleForSettlement({ ...base, paymentMethod: "TWINT" })).toBe(false);
    expect(isEligibleForSettlement({ ...base, paymentMethod: "CARD" })).toBe(false);
  });

  it("is not eligible until the customer has paid the seller", () => {
    expect(isEligibleForSettlement({ ...base, customerPaymentStatus: "PENDING" })).toBe(false);
  });

  it("is not eligible without an assigned seller", () => {
    expect(isEligibleForSettlement({ ...base, sellerId: null })).toBe(false);
  });

  it("is not eligible once already settled — prevents double settlement", () => {
    expect(isEligibleForSettlement({ ...base, alreadySettled: true })).toBe(false);
  });

  it("is not eligible for a refunded order", () => {
    expect(isEligibleForSettlement({ ...base, customerPaymentStatus: "REFUNDED" })).toBe(false);
  });
});
