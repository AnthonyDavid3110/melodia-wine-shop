export interface SettlementEligibilityOrderInput {
  paymentMethod: "TWINT" | "CARD" | "SELLER";
  customerPaymentStatus: "PENDING" | "PAID" | "REFUNDED";
  sellerId: string | null;
  /** True if this order's amount is already part of some settlement (any status). */
  alreadySettled: boolean;
}

/**
 * docs/08-PAYMENTS.md §35: an order is eligible for inclusion in a new
 * seller settlement only when it's a seller-payment order, the
 * customer has paid the seller, a seller is assigned, and the amount
 * hasn't already been settled — directly protects "the same
 * seller-payment amount cannot be settled twice" (§56 invariant 9).
 */
export function isEligibleForSettlement(order: SettlementEligibilityOrderInput): boolean {
  return (
    order.paymentMethod === "SELLER" &&
    order.customerPaymentStatus === "PAID" &&
    order.sellerId !== null &&
    !order.alreadySettled
  );
}
