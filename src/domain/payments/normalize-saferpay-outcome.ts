/**
 * Pure Saferpay-result normalization (Phase 10 Gate 10B). The domain
 * layer never depends on raw Saferpay HTTP response shapes — the
 * infrastructure adapter (`src/infrastructure/payments/saferpay-client.ts`)
 * translates a Saferpay Assert response into this small, explicit
 * `SaferpayAssertOutcome` before calling here, exactly matching this
 * project's existing "provider-specific states must be translated into
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

export type NormalizedPaymentOutcome =
  | { status: "SUCCEEDED" }
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
      return { status: "SUCCEEDED" };
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
