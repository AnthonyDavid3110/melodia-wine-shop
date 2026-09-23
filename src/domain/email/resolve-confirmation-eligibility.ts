/**
 * Phase 11 Gate 11C — pure, authoritative eligibility/variant
 * determination for (re)sending an order-confirmation email. Mirrors
 * `src/domain/payments/payment-guards.ts`'s `canReconcileOnlinePayment`
 * style: derived only from currently persisted order/payment state,
 * never from prior email history, fulfilment progress, or `source`
 * (docs/10-IMPLEMENTATION-PLAN.md Phase 11 Gate 11C §7).
 */

export interface ConfirmationEligibilityOrderInput {
  status: string;
  customerPaymentStatus: string;
}

export interface ConfirmationEligibilityPaymentInput {
  provider: string;
  method: string;
  status: string;
}

export type ConfirmationEligibilityReason =
  "order-cancelled" | "online-payment-not-completed" | "seller-payment-not-pending";

export type ConfirmationEligibilityResult =
  | { eligible: true; paymentMethod: "SELLER" | "TWINT" | "CARD" }
  | { eligible: false; reason: ConfirmationEligibilityReason };

/**
 * ## ONLINE_PAID
 * Only when a `SAFERPAY` payment attempt on this order has genuinely
 * reached `SUCCEEDED` — the exact same authoritative signal Gate 11B's
 * own automatic dispatch trusts (docs/08-PAYMENTS.md §71). Fulfilment
 * progression (`PREPARED`/`HANDED_TO_SELLER`/`DELIVERED`) never affects
 * this — payment truth is independent of fulfilment (BR-STA-001).
 *
 * ## SELLER_PAYMENT
 * Only when a `SELLER`-method payment exists AND
 * `customerPaymentStatus === "PENDING"`. The existing template says
 * payment is still due — once an admin has marked it `PAID` (or, if
 * ever reachable, `REFUNDED`), that wording is no longer true and no
 * "already resolved" variant exists (Gate 11C explicit decision: do not
 * build one). Applies identically to `MANUAL` and public-checkout
 * orders — `source` is deliberately never consulted here.
 *
 * ## Ineligible
 * `CANCELLED` orders are always ineligible — the confirmation's core
 * premise (an active order that will be delivered) is no longer true,
 * independent of payment status.
 */
export function resolveOrderConfirmationEligibility(
  order: ConfirmationEligibilityOrderInput,
  payments: readonly ConfirmationEligibilityPaymentInput[],
): ConfirmationEligibilityResult {
  if (order.status === "CANCELLED") {
    return { eligible: false, reason: "order-cancelled" };
  }

  const succeededOnlinePayment = payments.find(
    (payment) => payment.provider === "SAFERPAY" && payment.status === "SUCCEEDED",
  );
  if (succeededOnlinePayment) {
    const method = succeededOnlinePayment.method === "CARD" ? "CARD" : "TWINT";
    return { eligible: true, paymentMethod: method };
  }

  const hasSellerPayment = payments.some((payment) => payment.method === "SELLER");
  if (hasSellerPayment) {
    if (order.customerPaymentStatus === "PENDING") {
      return { eligible: true, paymentMethod: "SELLER" };
    }
    return { eligible: false, reason: "seller-payment-not-pending" };
  }

  return { eligible: false, reason: "online-payment-not-completed" };
}

/** French admin-facing explanation for an ineligible order — no provider/internal detail. */
export function confirmationEligibilityReasonLabel(reason: ConfirmationEligibilityReason): string {
  switch (reason) {
    case "order-cancelled":
      return "Cette commande est annulée — aucune confirmation ne peut être envoyée.";
    case "online-payment-not-completed":
      return "Le paiement en ligne n'a pas encore été confirmé — aucune confirmation ne peut être envoyée.";
    case "seller-payment-not-pending":
      return "Le paiement de cette commande a déjà été traité — la confirmation d'origine n'est plus à jour.";
    default:
      return reason;
  }
}
