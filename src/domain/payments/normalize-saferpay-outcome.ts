/**
 * Pure Saferpay-result normalization (Phase 10 Gate 10B/10C-A). The
 * domain layer never depends on raw Saferpay HTTP response shapes — the
 * infrastructure adapter (`src/infrastructure/payments/saferpay-client.ts`)
 * translates a Saferpay Assert/Capture response into small, explicit
 * outcome types before calling here, exactly matching this project's
 * existing "provider-specific states must be translated into
 * application domain states" principle (docs/04-DATA-MODEL.md §19,
 * BR-PAY invariant).
 *
 * Per the official Saferpay JSON API documentation
 * (https://saferpay.github.io/jsonapi/, PaymentPage/Assert): a
 * successful call (HTTP 200) returns `Transaction.Status` of
 * `AUTHORIZED`, `CAPTURED`, or — for Account-to-Account methods only,
 * not used by this project — `PENDING`. A failed/aborted/declined
 * transaction returns an HTTP 400+ error response instead, with an
 * `ErrorName` (e.g. `TRANSACTION_ABORTED` for a payer-cancelled
 * payment, `TRANSACTION_DECLINED` for a processor decline). There is no
 * single unified "status enum" covering every outcome — this function
 * is precisely the translation boundary between that two-shaped
 * protocol and this application's one-shaped `PaymentStatus` model.
 *
 * Gate 10C-A correction: `AUTHORIZED` and `CAPTURED` are NOT
 * financially equivalent (docs.saferpay.com, Payment Page integration
 * guide, verbatim: "If the status is AUTHORIZED, a Capture needs to be
 * performed. If the status is CAPTURED, you do not need to finalize" —
 * and the Capture guide: "As long as a transaction has not passed
 * through the capture, the amount is merely reserved… it will not be
 * transferred to the merchant account"). Only `CAPTURED` (directly from
 * Assert, or after a successful `Transaction/Capture` call) is
 * financially final. `AUTHORIZED` normalizes to `REQUIRES_CAPTURE`, a
 * distinct, non-terminal outcome — never `SUCCEEDED`.
 */

export interface SaferpaySuccessDetails {
  transactionId: string;
  amountValue: string;
  currencyCode: string;
  paymentMethod: string;
}

export type SaferpayAssertOutcome =
  | ({ kind: "success"; providerStatus: "AUTHORIZED" | "CAPTURED" } & SaferpaySuccessDetails)
  | { kind: "pending" }
  | { kind: "aborted" }
  | { kind: "declined"; errorName: string; message: string }
  | { kind: "unrecognized"; detail: string };

/**
 * `Transaction/Capture` response, normalized by
 * `saferpay-client.ts#capturePayment()` (docs.saferpay.com, Capture and
 * Daily Closing). `already_captured` corresponds to the official
 * `TRANSACTION_ALREADY_CAPTURED` error — per the docs, verbatim, "this
 * error doesn't mean, that this transaction has failed. It simply
 * means, that the capture has already been executed" — so it is treated
 * as a SUCCESS signal, not a failure (this is also Saferpay's own
 * documented idempotency mechanism for Capture: calling it twice, e.g.
 * from two concurrent confirmations, never double-captures — the loser
 * just observes this error). `pending` is a legitimate documented
 * Capture status (kept for schema fidelity) but is not financially
 * final. Any other Saferpay-reported error (`AMOUNT_INVALID`,
 * `TRANSACTION_NOT_FOUND`, `VALIDATION_FAILED`, `INTERNAL_ERROR`, …) is
 * a technical/integration condition, not a customer-facing decline of
 * an already-authorized payment — there is no documented "capture
 * declined" business outcome, so every other case is bucketed as
 * `unrecognized` and stays conservative (never FAILED) rather than
 * inventing a decline semantic the protocol doesn't define.
 */
export type SaferpayCaptureOutcome =
  | { kind: "captured"; captureId: string }
  | { kind: "pending"; captureId: string }
  | { kind: "already_captured" }
  | { kind: "unrecognized"; detail: string };

export type NormalizedPaymentOutcome =
  | { status: "SUCCEEDED" }
  | { status: "REQUIRES_CAPTURE" }
  | { status: "CANCELLED" }
  | { status: "FAILED" }
  | { status: "PROCESSING"; anomaly: boolean };

/**
 * Never maps an unrecognized/unparseable provider result to `SUCCEEDED`
 * or a terminal `FAILED`/`CANCELLED` — an outcome this function can't
 * confidently classify is treated as still-pending (safe: no financial
 * state change), but flagged `anomaly: true` so the caller can surface
 * it for administrative review (docs/08-PAYMENTS.md §57's "financial
 * anomalies must be surfaced rather than silently corrected" invariant)
 * rather than silently retrying forever or guessing.
 */
export function normalizeSaferpayOutcome(outcome: SaferpayAssertOutcome): NormalizedPaymentOutcome {
  switch (outcome.kind) {
    case "success":
      return outcome.providerStatus === "CAPTURED"
        ? { status: "SUCCEEDED" }
        : { status: "REQUIRES_CAPTURE" };
    case "pending":
      return { status: "PROCESSING", anomaly: false };
    case "aborted":
      return { status: "CANCELLED" };
    case "declined":
      return { status: "FAILED" };
    case "unrecognized":
      return { status: "PROCESSING", anomaly: true };
  }
}

/**
 * Normalizes a `Transaction/Capture` result into the same
 * `NormalizedPaymentOutcome` vocabulary — only ever produces
 * `SUCCEEDED` (captured, by this call or a concurrent one) or
 * `PROCESSING` (still pending, or an unrecognized/technical condition)
 * — Capture never yields `CANCELLED`/`FAILED`/`REQUIRES_CAPTURE`, since
 * the underlying authorization already succeeded by the time Capture is
 * called (Gate 10C-A §15: capture-time uncertainty is never mapped to a
 * customer-facing failure).
 */
export function normalizeSaferpayCaptureOutcome(
  outcome: SaferpayCaptureOutcome,
): NormalizedPaymentOutcome {
  switch (outcome.kind) {
    case "captured":
    case "already_captured":
      return { status: "SUCCEEDED" };
    case "pending":
      return { status: "PROCESSING", anomaly: false };
    case "unrecognized":
      return { status: "PROCESSING", anomaly: true };
  }
}
