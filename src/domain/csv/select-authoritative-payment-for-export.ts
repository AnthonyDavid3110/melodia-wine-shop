/**
 * Deterministic one-row-per-order payment selection for `orders.csv`
 * (Phase 12 Gate 12A, approved Step 1 §4). An order can have several
 * `Payment` rows over time (retries, one SELLER row) — this picks
 * exactly one to represent in a single CSV row, never one row per
 * payment attempt.
 *
 * Rule:
 * 1. A `SUCCEEDED` payment, if one exists. The rest of the codebase
 *    structurally prevents a second `SUCCEEDED` row from ever existing
 *    for the same order (`applySuccessfulOnlinePayment()` in
 *    `src/infrastructure/payments/online-payments.ts` records a
 *    `PAYMENT_ANOMALY_DETECTED` event and refuses the transition
 *    instead) — the earliest-`paidAt` tie-break below only guards
 *    against that invariant ever being violated, it is not expected
 *    to matter in practice.
 * 2. Otherwise, the most recent attempt by `createdAt` — covers a
 *    still-`PENDING` SELLER row or the latest online attempt
 *    (`FAILED`/`CANCELLED`/`PROCESSING`/`PENDING`).
 * 3. Otherwise `null` (no payment row exists yet for this order).
 *
 * The final `id` comparison in both branches is a purely TECHNICAL
 * determinism tie-break for output stability when timestamps
 * coincide — a lexicographically smaller/larger UUID does NOT mean
 * "created earlier/later"; it is never used as evidence of
 * chronology.
 */
export interface PaymentAttemptForExportSelection {
  id: string;
  method: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

export function selectAuthoritativePaymentForExport<T extends PaymentAttemptForExportSelection>(
  payments: readonly T[],
): T | null {
  if (payments.length === 0) {
    return null;
  }

  const succeeded = payments.filter((payment) => payment.status === "SUCCEEDED");
  if (succeeded.length > 0) {
    return [...succeeded].sort((a, b) => {
      const aTime = a.paidAt?.getTime() ?? 0;
      const bTime = b.paidAt?.getTime() ?? 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })[0]!;
  }

  return [...payments].sort((a, b) => {
    const aTime = a.createdAt.getTime();
    const bTime = b.createdAt.getTime();
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  })[0]!;
}
