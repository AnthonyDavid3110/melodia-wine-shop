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
 *
 * Phase 10 addition: excludes `NEW` orders. An offline (SELLER) order
 * is never `NEW` — `createOrder()` puts it straight to `CONFIRMED`
 * (Phase 7) — while an online (Saferpay) order starts `NEW` and only
 * ever leaves `PENDING` once `confirmOnlinePayment()`'s own trusted
 * transaction marks it `PAID` (at which point this guard would already
 * be false via the `customerPaymentStatus` check alone). So `status !==
 * "NEW"` is a precise, sufficient signal to keep this manual admin
 * action off online orders entirely — docs/06-ADMIN-SPEC.md §20:
 * "Never add a manual 'mark online payment paid' action."
 */
export function canMarkCustomerPaymentReceived(
  order: Pick<OrderGuardInput, "status" | "customerPaymentStatus">,
): boolean {
  return (
    order.status !== "CANCELLED" &&
    order.status !== "NEW" &&
    order.customerPaymentStatus === "PENDING"
  );
}

/**
 * Phase 9 fulfilment guards — strictly sequential, one step at a time
 * (docs/10 §60: "CONFIRMED → PREPARED → HANDED_TO_SELLER →
 * DELIVERED"). Each guard checks the exact current status rather than
 * "not yet reached this step", so CONFIRMED → HANDED_TO_SELLER or
 * CONFIRMED → DELIVERED are rejected exactly like a CANCELLED order
 * would be — there is no separate CANCELLED check needed because
 * CANCELLED never equals the required exact status. `NEW` (reserved for
 * a future online-payment-awaiting state, never produced by the current
 * `createOrder()`) is deliberately NOT treated as CONFIRMED here — it
 * simply cannot prepare yet, preserving its documented future role
 * without inventing a transition for it.
 */
export function canPrepareOrder(order: Pick<OrderGuardInput, "status">): boolean {
  return order.status === "CONFIRMED";
}

/**
 * Handoff requires both the PREPARED status and an assigned seller
 * (Phase 9 approved decision — physical orders cannot be handed to
 * nobody). Central preparation itself has no such requirement — see
 * `canPrepareOrder`.
 */
export function canHandOrderToSeller(
  order: Pick<OrderGuardInput, "status"> & { sellerId: string | null },
): boolean {
  return order.status === "PREPARED" && order.sellerId !== null;
}

export function canMarkOrderDelivered(order: Pick<OrderGuardInput, "status">): boolean {
  return order.status === "HANDED_TO_SELLER";
}
