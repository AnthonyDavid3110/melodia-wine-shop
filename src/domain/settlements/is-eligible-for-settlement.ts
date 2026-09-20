export interface SettlementEligibilityOrderInput {
  paymentMethod: "TWINT" | "CARD" | "SELLER";
  customerPaymentStatus: "PENDING" | "PAID" | "REFUNDED";
  sellerId: string | null;
  /** True if this order's amount is already part of some settlement (any status). */
  alreadySettled: boolean;
  /** Order.status — Phase 8 addition: a CANCELLED order can never be settlement-eligible, even if it was PAID before cancellation. */
  orderStatus: string;
}

/**
 * docs/08-PAYMENTS.md §35: an order is eligible for inclusion in a new
 * seller settlement only when it's a seller-payment order, the
 * customer has paid the seller, a seller is assigned, the amount
 * hasn't already been settled, and the order isn't cancelled —
 * directly protects "the same seller-payment amount cannot be settled
 * twice" (§56 invariant 9). `orderStatus` was added in Phase 8: Phase 7
 * couldn't reach a CANCELLED+PAID combination (cancellation had no
 * payment-state guard yet), but Phase 8's own cancellation guard change
 * means this condition must be explicit here too, not merely assumed
 * unreachable.
 */
export function isEligibleForSettlement(order: SettlementEligibilityOrderInput): boolean {
  return (
    order.paymentMethod === "SELLER" &&
    order.customerPaymentStatus === "PAID" &&
    order.sellerId !== null &&
    !order.alreadySettled &&
    order.orderStatus !== "CANCELLED"
  );
}
