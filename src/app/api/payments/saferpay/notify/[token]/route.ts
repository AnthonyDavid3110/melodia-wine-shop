import {
  MultipleUnresolvedPaymentAttemptsError,
  NoReconcilablePaymentAttemptError,
  PaymentAttemptNotFoundError,
  confirmOnlinePayment,
} from "@/infrastructure/payments/online-payments";
import { OrderNotFoundError } from "@/infrastructure/orders/orders";

export const dynamic = "force-dynamic";

/**
 * Saferpay's `SuccessNotifyUrl`/`FailNotifyUrl` server-to-server
 * callback (Phase 10 Gate 10C-B1, docs/08-PAYMENTS.md §71.6) —
 * registered as the SAME URL for both on `PaymentPage/Initialize`
 * (`saferpay-client.ts`). A plain Route Handler, not a Server Action:
 * Saferpay calls this as a raw external HTTP GET, which Server Actions
 * cannot serve.
 *
 * Threat model (docs/09-SECURITY.md): this request is UNAUTHENTICATED
 * and carries NO signed financial payload — per official Saferpay
 * documentation there is no signature on this callback at all. The
 * 256-bit opaque `token` (the same `payments.return_token` used in the
 * public ReturnUrl) is a capability/correlation identifier, never a
 * verdict. Receiving this request means only "Saferpay says something
 * changed for this Payment" — it NEVER itself marks anything
 * SUCCEEDED/FAILED/CANCELLED/PAID/CONFIRMED. The only mutation path is
 * the exact same `confirmOnlinePayment()` the browser return route and
 * admin manual reconciliation use, which re-derives the trusted result
 * via `PaymentPage/Assert` (and `Transaction/Capture` when Assert
 * reports AUTHORIZED — Gate 10C-A) before applying any state change.
 * CSRF protections do not apply here: there is no ambient
 * cookie/session authentication for a CSRF token to guard, and even a
 * maliciously-replayed request only ever triggers a harmless re-Assert.
 * No rate limiting is added in this gate — see docs/08-PAYMENTS.md
 * §71.7 for the documented reasoning (early DB lookup before any
 * provider call + terminal-state short-circuit already bound the abuse
 * surface).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Conservative shape check before any DB/provider work — the real
  // token is a 256-bit base64url string (~43 chars); anything obviously
  // malformed is rejected without a lookup.
  if (!token || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) {
    return new Response("OK", { status: 200 });
  }

  try {
    const result = await confirmOnlinePayment(token);
    if (result.status === "PROCESSING" && result.transient) {
      // Our own outbound call to Saferpay failed at the transport level
      // — genuinely worth Saferpay's own callback-retry mechanism
      // (docs/08-PAYMENTS.md §71.6). Never mapped to FAILED.
      return new Response("Service Unavailable", { status: 503 });
    }
    // Reconciled (any terminal outcome), already-terminal, a duplicate
    // callback, or a durable anomaly already recorded — all "handled"
    // from Saferpay's perspective; retrying will not change anything.
    return new Response("OK", { status: 200 });
  } catch (error) {
    if (
      error instanceof PaymentAttemptNotFoundError ||
      error instanceof OrderNotFoundError ||
      error instanceof NoReconcilablePaymentAttemptError ||
      error instanceof MultipleUnresolvedPaymentAttemptsError
    ) {
      // Unknown/unresolvable token — never reveal whether an Order
      // exists, and never invite a retry that can never resolve it.
      return new Response("OK", { status: 200 });
    }
    // Configuration failure, unexpected DB failure, or any other
    // unforeseen error — retryable; never leak diagnostic detail
    // (docs/09-SECURITY.md §39), never mutate financial state here.
    console.error("[saferpay-notify] reconciliation failed:", (error as Error).name);
    return new Response("Service Unavailable", { status: 503 });
  }
}
