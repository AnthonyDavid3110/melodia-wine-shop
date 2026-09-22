/**
 * Pure online-payment guards (Phase 10 Gate 10B) — the single source of
 * truth for whether an online-payment action is currently allowed,
 * mirroring the established `src/domain/orders/order-guards.ts`
 * pattern. Infrastructure enforcement
 * (`src/infrastructure/payments/online-payments.ts`) is what actually
 * enforces these; the checkout/return UI only uses them to decide what
 * to show (docs/09-SECURITY.md BR-ADM-003 — hiding a control is never
 * the authorization boundary, the same principle applied to a customer-
 * facing action here).
 */

export interface OnlinePaymentOrderInput {
  status: string;
  customerPaymentStatus: string;
}

/**
 * An online payment may only be initiated against an Order still
 * awaiting its first trusted confirmation — `NEW` +
 * `customerPaymentStatus = PENDING` (Phase 10 §4 approved semantics).
 * Once `CONFIRMED`/`PAID`, or once `CANCELLED`, no further attempt is
 * eligible.
 */
export function canInitiateOnlinePayment(order: OnlinePaymentOrderInput): boolean {
  return order.status === "NEW" && order.customerPaymentStatus === "PENDING";
}

export interface PaymentAttemptInput {
  status: string;
}

/** A non-terminal attempt already in flight — PENDING (session not yet confirmed) or PROCESSING. */
export function isActivePaymentAttempt(payment: PaymentAttemptInput): boolean {
  return payment.status === "PENDING" || payment.status === "PROCESSING";
}

export function hasActivePaymentAttempt(payments: readonly PaymentAttemptInput[]): boolean {
  return payments.some(isActivePaymentAttempt);
}

/**
 * Retry eligibility (Phase 10 §5/§20) — a fresh attempt is allowed once
 * the Order itself is still eligible AND no attempt is currently
 * active. A terminal `FAILED`/`CANCELLED` attempt never blocks a retry;
 * it is simply left as historical record (never mutated back into an
 * active state).
 */
export function canRetryOnlinePayment(
  order: OnlinePaymentOrderInput,
  payments: readonly PaymentAttemptInput[],
): boolean {
  return canInitiateOnlinePayment(order) && !hasActivePaymentAttempt(payments);
}

/**
 * Trusted-success eligibility for the atomic confirmation transaction
 * (Phase 10 §16) — the specific Payment attempt must still be
 * non-terminal, and the Order must still be `NEW`. Re-applying an
 * already-SUCCEEDED attempt is a safe idempotent no-op at the call
 * site, not something this guard needs to allow.
 */
export function canConfirmOnlinePaymentSuccess(
  order: OnlinePaymentOrderInput,
  payment: PaymentAttemptInput,
): boolean {
  return order.status === "NEW" && isActivePaymentAttempt(payment);
}

export interface PaymentAttemptWithProviderInput extends PaymentAttemptInput {
  provider: string;
}

/**
 * Whether the admin "Vérifier auprès de Saferpay" manual reconciliation
 * action (Phase 10 Gate 10C-B1 §22/§24) should be offered for this
 * Order — a real Order-level decision, so the UI and the server action
 * both consult the same rule (hiding a control is never itself the
 * authorization boundary). Shown only for an Order still awaiting its
 * first trusted confirmation (`NEW`/`PENDING`, matching
 * `canInitiateOnlinePayment`) that has at least one non-terminal
 * SAFERPAY attempt — never for offline SELLER orders (no SAFERPAY
 * attempt exists), never for an already-PAID online Order, never when
 * every online attempt is already terminal FAILED/CANCELLED with
 * nothing left to reconcile.
 */
export function canReconcileOnlinePayment(
  order: OnlinePaymentOrderInput,
  payments: readonly PaymentAttemptWithProviderInput[],
): boolean {
  return (
    canInitiateOnlinePayment(order) &&
    payments.some((payment) => payment.provider === "SAFERPAY" && isActivePaymentAttempt(payment))
  );
}
