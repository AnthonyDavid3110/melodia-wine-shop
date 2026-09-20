/**
 * Pure financial-state guards (Phase 8) — the single source of truth
 * for whether an order-level admin action is currently allowed. Reused
 * identically by the authoritative infrastructure mutations
 * (`infrastructure/orders/orders.ts`) and by the UI (to decide whether
 * to show/enable a control) — but the infra layer is what actually
 * enforces these, never the UI alone (docs/09-SECURITY.md BR-ADM-003,
 * "hiding a button is not authorization").
 */

export interface OrderGuardInput {
  status: string;
  customerPaymentStatus: string;
  sellerSettlementStatus: string;
}

/**
 * Cancellation guard (Phase 8 approved decision #2). Allowed only while
 * `customerPaymentStatus = PENDING` and `sellerSettlementStatus !=
 * SETTLED` — once money has changed hands (customer→seller or
 * seller→ECM), cancellation is blocked until a future reversal/refund
 * workflow exists. Never silently refunds/reverses anything.
 */
export function canCancelOrder(order: OrderGuardInput): boolean {
  if (order.status === "CANCELLED") return false;
  if (order.customerPaymentStatus === "PAID") return false;
  if (order.sellerSettlementStatus === "SETTLED") return false;
  return true;
}

/**
 * Seller reassignment guard (Phase 8 approved decision #1). Blocked
 * only once `sellerSettlementStatus = SETTLED` — a completed settlement
 * is a historical record of which seller remitted the money, and
 * reassigning afterward would make the order's live seller disagree
 * with that history. PENDING payment and PAID-but-unsettled orders may
 * still be freely reassigned (docs/09-SECURITY.md §67 lists seller
 * reassignment as an allowed non-monetary correction).
 */
export function canReassignSeller(order: Pick<OrderGuardInput, "sellerSettlementStatus">): boolean {
  return order.sellerSettlementStatus !== "SETTLED";
}

/**
 * Mark-customer-payment-received guard. Only a PENDING seller-payment
 * order on a non-cancelled order may transition — this is the only
 * valid entry into the PAID state in Phase 8 (BR-PAY-006/007: no
 * automatic/provider marking for the offline path).
 */
export function canMarkCustomerPaymentReceived(
  order: Pick<OrderGuardInput, "status" | "customerPaymentStatus">,
): boolean {
  return order.status !== "CANCELLED" && order.customerPaymentStatus === "PENDING";
}
