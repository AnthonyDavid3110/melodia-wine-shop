import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import {
  orderEvents,
  orderItems,
  orders,
  paymentEvents,
  payments,
  sellers,
} from "../database/schema";
import { OrderNotFoundError } from "../orders/orders";
import {
  canConfirmOnlinePaymentSuccess,
  canInitiateOnlinePayment,
  isActivePaymentAttempt,
} from "@/domain/payments/payment-guards";
import {
  normalizeSaferpayCaptureOutcome,
  normalizeSaferpayOutcome,
  type SaferpayAssertOutcome,
  type SaferpayCaptureOutcome,
  type SaferpaySuccessDetails,
} from "@/domain/payments/normalize-saferpay-outcome";
import { type Money } from "@/domain/money";
import { appUrl } from "@/lib/app-url";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { dispatchOrderConfirmationEmail } from "@/infrastructure/email/order-confirmation";
import type { OrderConfirmationEmailInput } from "@/domain/email/order-confirmation-content";
import * as saferpayClient from "./saferpay-client";
import * as fakeTestProvider from "./fake-test-provider";

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

/**
 * Double-gated test-provider seam (Gate 10B §25): the fake provider is
 * only ever selected when BOTH `NODE_ENV !== "production"` AND the
 * explicit `E2E_FAKE_PAYMENT_PROVIDER=true` opt-in are true — the
 * latter is set only in `playwright.config.ts`'s own `webServer.env`,
 * never in `.env.example` or any real deployment configuration. Even a
 * mistaken production env var alone can never activate it.
 */
function getProvider(): Pick<
  typeof saferpayClient,
  "initializePaymentPage" | "assertPaymentPage" | "capturePayment"
> {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_PAYMENT_PROVIDER === "true") {
    return fakeTestProvider;
  }
  return saferpayClient;
}

/**
 * Whether checkout should offer online payment at all — real Saferpay
 * configuration, OR the same double-gated fake test provider
 * `getProvider()` itself uses (so the e2e suite can exercise the
 * checkout method selector without ever touching real credentials).
 */
export function isOnlinePaymentAvailable(): boolean {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_PAYMENT_PROVIDER === "true") {
    return true;
  }
  return saferpayClient.isSaferpayConfigured();
}

export class OnlinePaymentNotEligibleError extends Error {
  constructor() {
    super("Cette commande n'est plus éligible au paiement en ligne.");
    this.name = "OnlinePaymentNotEligibleError";
  }
}

export class PaymentAttemptNotFoundError extends Error {
  constructor() {
    super("Tentative de paiement introuvable.");
    this.name = "PaymentAttemptNotFoundError";
  }
}

/**
 * Gate 10C-A — thrown instead of silently superseding an active attempt
 * that Saferpay has already authorized (`providerPaymentId` set) but
 * whose local capture confirmation is still uncertain. Superseding it
 * would cancel it only locally — Saferpay itself is never told — so a
 * customer completing a fresh attempt on top of it could be charged
 * twice. The existing return page already reconciles this state
 * automatically (its own poll re-attempts Assert/Capture); this error
 * only ever surfaces if a retry is attempted while that reconciliation
 * is still unresolved.
 */
export class PaymentAttemptUnresolvedError extends Error {
  constructor() {
    super(
      "Votre précédent paiement est en cours de vérification. Veuillez patienter un instant avant de réessayer.",
    );
    this.name = "PaymentAttemptUnresolvedError";
  }
}

/** Gate 10C-B1 admin reconciliation — no eligible Saferpay attempt found for this Order. */
export class NoReconcilablePaymentAttemptError extends Error {
  constructor() {
    super("Aucune tentative de paiement en ligne à vérifier pour cette commande.");
    this.name = "NoReconcilablePaymentAttemptError";
  }
}

/**
 * Gate 10C-B1 admin reconciliation — more than one Saferpay attempt is
 * simultaneously active for the same Order. `initiateOnlinePayment()`'s
 * own supersede/refuse logic should make this unreachable in practice;
 * surfaced as a controlled error rather than guessing which attempt to
 * trust (§23 of the gate brief).
 */
export class MultipleUnresolvedPaymentAttemptsError extends Error {
  constructor() {
    super(
      "Plusieurs tentatives de paiement en ligne sont actives pour cette commande — situation inattendue, vérifiez manuellement dans Saferpay avant de poursuivre.",
    );
    this.name = "MultipleUnresolvedPaymentAttemptsError";
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505" &&
    "constraint" in error &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}

/**
 * The public opaque return-correlation token (Phase 10 Gate 10B §6) —
 * generated server-side, 256 bits of entropy, URL-safe, never derived
 * from PII/order number/database id. Payment-level (not Order-level):
 * each online attempt gets its own Saferpay session and therefore its
 * own return correlation.
 */
function generateReturnToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface InitiateOnlinePaymentResult {
  redirectUrl: string;
}

/**
 * Starts (or restarts) an online payment attempt (Gate 10B §10/§5).
 * Sequence, matching the gate's recommended shape: (1) validate
 * eligibility and supersede any stale active attempt inside one
 * transaction that also inserts the new local Payment row in its
 * initial PENDING state, and commits; (2) call Saferpay
 * PaymentPage/Initialize OUTSIDE any transaction (never hold a DB
 * transaction across an external HTTP call); (3) persist the returned
 * session Token. A stale prior active attempt is superseded
 * (CANCELLED) rather than resumed, because Saferpay only returns its
 * RedirectUrl once from Initialize — an old attempt's redirect cannot
 * be recovered, so a fresh attempt is the only deterministic choice
 * (Gate 10B §5's "deterministic retry/reuse semantics").
 */
export async function initiateOnlinePayment(
  orderId: string,
  method: "TWINT" | "CARD",
  dbHandle: DbHandle = db,
): Promise<InitiateOnlinePaymentResult> {
  const { paymentId, returnToken, amount, orderNumber } = await dbHandle.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    if (!canInitiateOnlinePayment(order)) {
      throw new OnlinePaymentNotEligibleError();
    }

    const existingPayments = await tx.select().from(payments).where(eq(payments.orderId, orderId));
    for (const existing of existingPayments) {
      if (!isActivePaymentAttempt(existing)) {
        continue;
      }
      if (existing.providerPaymentId) {
        // Gate 10C-A: Saferpay has already authorized THIS attempt
        // (recorded as soon as Assert reports AUTHORIZED — see
        // confirmOnlinePayment) — cancelling it locally would not
        // cancel it at Saferpay, so starting a fresh attempt here could
        // double-charge the customer. Refuse; the return page's own
        // polling already reconciles this automatically.
        throw new PaymentAttemptUnresolvedError();
      }
      await tx.update(payments).set({ status: "CANCELLED" }).where(eq(payments.id, existing.id));
    }

    const token = generateReturnToken();
    const [created] = await tx
      .insert(payments)
      .values({
        orderId,
        method,
        provider: "SAFERPAY",
        amount: order.totalAmount,
        currency: "CHF",
        status: "PENDING",
        returnToken: token,
      })
      .returning();
    if (!created) {
      throw new Error("initiateOnlinePayment: payment insert returned no row.");
    }

    return {
      paymentId: created.id,
      returnToken: token,
      amount: order.totalAmount as Money,
      orderNumber: order.orderNumber,
    };
  });

  const saferpayMethods =
    method === "TWINT" ? (["TWINT"] as const) : (["VISA", "MASTERCARD"] as const);

  let initialized;
  try {
    // Gate 10C-B1: both callback URLs are built here from the trusted
    // server-only APP_BASE_URL, via the URL-constructor-based appUrl()
    // helper (never naive string concatenation) — a missing/invalid
    // APP_BASE_URL throws AppBaseUrlNotConfiguredError, caught by the
    // same catch block as an Initialize failure below, so it correctly
    // marks this phantom attempt FAILED rather than leaving it stuck
    // PENDING forever.
    const returnUrl = appUrl("/commande/retour", { rt: returnToken });
    const notifyUrl = appUrl(`/api/payments/saferpay/notify/${returnToken}`);
    initialized = await getProvider().initializePaymentPage({
      amount,
      orderNumber,
      description: `Commande ${orderNumber} — Les Vins de Mélodia`,
      returnUrl,
      notifyUrl,
      paymentMethods: saferpayMethods,
    });
  } catch (error) {
    // The provider call itself failed (rejected, timed out, network
    // error) — the local attempt never got a session, so it must not
    // linger as a phantom PENDING attempt blocking a future retry.
    await dbHandle
      .update(payments)
      .set({ status: "FAILED", failedAt: new Date() })
      .where(eq(payments.id, paymentId));
    throw error;
  }

  await dbHandle
    .update(payments)
    .set({ providerSessionId: initialized.token })
    .where(eq(payments.id, paymentId));

  return { redirectUrl: initialized.redirectUrl };
}

export interface ConfirmOnlinePaymentResult {
  status: "SUCCEEDED" | "PROCESSING" | "FAILED" | "CANCELLED";
  orderNumber: string;
  anomaly?: boolean;
  /**
   * Gate 10C-B1 — set only when `status` is `PROCESSING` because OUR
   * OWN outbound call to Saferpay failed at the transport level (a
   * genuine network/timeout condition), as opposed to Saferpay having
   * answered with a still-pending/unrecognized result. Distinguishes
   * "worth asking Saferpay's own callback-retry mechanism to try again
   * later" from "nothing external is actually broken" — used by the
   * notify route to choose its HTTP response code (docs/08-PAYMENTS.md
   * §71.6); the browser-return page ignores this field entirely.
   */
  transient?: boolean;
}

/**
 * The trusted result-lookup used by the public return route (Gate 10B
 * §12/§15/§16, corrected in Gate 10C-A) — safe to call repeatedly
 * (browser refresh, a stray duplicate notification ping, etc.). Never
 * marks anything paid merely because this function was invoked; it
 * always asks Saferpay (PaymentPage/Assert) for the authoritative
 * result before applying any state change, except when the local
 * Payment is already terminal, in which case it returns that terminal
 * state directly without a redundant provider call.
 *
 * Gate 10C-A: `Assert` returning `AUTHORIZED` is NOT financially final
 * (docs.saferpay.com — see `normalize-saferpay-outcome.ts`). When
 * `Assert` reports `REQUIRES_CAPTURE`, this function calls
 * `Transaction/Capture` — outside any DB transaction, exactly like
 * `Assert` itself — and only a genuinely captured result (`CAPTURED`
 * directly from Assert, or a successful/already-captured `Capture`
 * call) reaches `applySuccessfulOnlinePayment()`. Concurrency safety
 * for two callers racing on the SAME `AUTHORIZED` transaction rests on
 * two independent layers: Saferpay's own server-side Capture
 * idempotency (a second concurrent `Capture` call returns
 * `TRANSACTION_ALREADY_CAPTURED`, normalized to the same `SUCCEEDED`
 * outcome as the winner), plus the existing `SELECT … FOR UPDATE`
 * lock + already-terminal early return inside
 * `applySuccessfulOnlinePayment()` itself — neither layer alone would
 * be sufficient, but together they guarantee the local trusted-success
 * transition still applies exactly once, without ever holding a DB
 * lock across a provider HTTP call.
 */
export async function confirmOnlinePayment(
  returnToken: string,
  dbHandle: DbHandle = db,
): Promise<ConfirmOnlinePaymentResult> {
  const [payment] = await dbHandle
    .select()
    .from(payments)
    .where(eq(payments.returnToken, returnToken));
  if (!payment) {
    throw new PaymentAttemptNotFoundError();
  }
  const [order] = await dbHandle.select().from(orders).where(eq(orders.id, payment.orderId));
  if (!order) {
    throw new OrderNotFoundError(payment.orderId);
  }

  if (
    payment.status === "SUCCEEDED" ||
    payment.status === "FAILED" ||
    payment.status === "CANCELLED"
  ) {
    return { status: payment.status, orderNumber: order.orderNumber };
  }

  if (!payment.providerSessionId) {
    // Initialize never completed for this attempt — nothing to Assert yet.
    return { status: "PROCESSING", orderNumber: order.orderNumber };
  }

  let outcome: SaferpayAssertOutcome;
  try {
    outcome = await getProvider().assertPaymentPage(payment.providerSessionId);
  } catch {
    // Provider unreachable right now — never fabricate a result; stay
    // PROCESSING, safe to retry on the next visit/poll.
    return { status: "PROCESSING", orderNumber: order.orderNumber, transient: true };
  }

  const normalized = normalizeSaferpayOutcome(outcome);

  if (
    (normalized.status === "SUCCEEDED" || normalized.status === "REQUIRES_CAPTURE") &&
    outcome.kind === "success"
  ) {
    if (outcome.currencyCode !== "CHF" || Number(outcome.amountValue) !== payment.amount) {
      await recordAnomaly(dbHandle, payment.id, order.id, "amount-or-currency-mismatch");
      return { status: "PROCESSING", orderNumber: order.orderNumber, anomaly: true };
    }

    if (normalized.status === "SUCCEEDED") {
      // Assert itself already reports CAPTURED — financially final.
      const applied = await applySuccessfulOnlinePayment(dbHandle, payment.id, outcome);
      return { status: applied, orderNumber: order.orderNumber };
    }

    // REQUIRES_CAPTURE (Assert reported AUTHORIZED): the authorization
    // succeeded but funds are merely reserved — Capture is required
    // before this can be treated as paid (Gate 10C-A). Outside any DB
    // transaction, exactly like Assert above.
    //
    // Record the genuine provider transaction id NOW, before attempting
    // Capture — this is the durable signal `initiateOnlinePayment` uses
    // to refuse silently superseding this attempt (see
    // PaymentAttemptUnresolvedError above) if capture confirmation is
    // still uncertain. Deliberately not part of the final atomic
    // success transaction below: it must be visible even if Capture
    // itself never resolves.
    if (!payment.providerPaymentId) {
      await dbHandle
        .update(payments)
        .set({ providerPaymentId: outcome.transactionId })
        .where(eq(payments.id, payment.id));
    }

    let captureOutcome: SaferpayCaptureOutcome;
    try {
      captureOutcome = await getProvider().capturePayment(outcome.transactionId);
    } catch {
      // Provider unreachable right now — never fabricate a result; the
      // authorization stands, but capture is unresolved. Stay
      // PROCESSING, safe to retry (a retried Capture call is safe even
      // if the first one actually reached Saferpay — see
      // TRANSACTION_ALREADY_CAPTURED handling in normalizeCapture).
      return { status: "PROCESSING", orderNumber: order.orderNumber, transient: true };
    }

    const normalizedCapture = normalizeSaferpayCaptureOutcome(captureOutcome);
    if (normalizedCapture.status === "SUCCEEDED") {
      const applied = await applySuccessfulOnlinePayment(dbHandle, payment.id, outcome);
      return { status: applied, orderNumber: order.orderNumber };
    }

    // Capture still PENDING, or an unrecognized/technical Capture
    // condition (e.g. AMOUNT_INVALID, TRANSACTION_NOT_FOUND) — never a
    // customer-facing decline of an already-authorized payment (Gate
    // 10C-A §15). Surface unrecognized conditions as an anomaly for
    // admin review; a still-pending capture is expected, not anomalous.
    if ("anomaly" in normalizedCapture && normalizedCapture.anomaly) {
      await recordAnomaly(dbHandle, payment.id, order.id, "capture-unrecognized-result");
    }
    return {
      status: "PROCESSING",
      orderNumber: order.orderNumber,
      anomaly: "anomaly" in normalizedCapture ? normalizedCapture.anomaly : false,
    };
  }

  if (normalized.status === "FAILED") {
    await dbHandle
      .update(payments)
      .set({ status: "FAILED", failedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return { status: "FAILED", orderNumber: order.orderNumber };
  }

  if (normalized.status === "CANCELLED") {
    await dbHandle.update(payments).set({ status: "CANCELLED" }).where(eq(payments.id, payment.id));
    return { status: "CANCELLED", orderNumber: order.orderNumber };
  }

  return {
    status: "PROCESSING",
    orderNumber: order.orderNumber,
    anomaly: "anomaly" in normalized ? normalized.anomaly : false,
  };
}

/**
 * Admin-triggered trusted manual reconciliation (Gate 10C-B1 §22/§23)
 * — for a `NEW` online Order whose Saferpay notification was lost or
 * whose browser never returned. Delegates entirely to the existing
 * `confirmOnlinePayment()` — no second financial mutation
 * implementation. Never accepts an orderId-scoped "just mark it paid"
 * shortcut: it locates the correct Payment row and re-runs the exact
 * same Assert/Capture-aware reconciliation a browser return or a
 * Saferpay notification would.
 *
 * Selection rule: exactly one non-terminal (`PENDING`) SAFERPAY Payment
 * attempt for the Order is reconciled. Zero eligible attempts and more
 * than one eligible attempt are both refused with a distinct, precise
 * error rather than guessing — the latter should be unreachable given
 * `initiateOnlinePayment()`'s own supersede/refuse logic, but is
 * treated as a real possibility, not assumed away.
 */
export async function reconcileOnlinePaymentForOrder(
  orderId: string,
  dbHandle: DbHandle = db,
): Promise<ConfirmOnlinePaymentResult> {
  const orderPayments = await dbHandle.select().from(payments).where(eq(payments.orderId, orderId));
  const eligible = orderPayments.filter(
    (payment) => payment.provider === "SAFERPAY" && isActivePaymentAttempt(payment),
  );

  if (eligible.length === 0) {
    throw new NoReconcilablePaymentAttemptError();
  }
  if (eligible.length > 1) {
    throw new MultipleUnresolvedPaymentAttemptsError();
  }

  const [target] = eligible;
  if (!target?.returnToken) {
    throw new NoReconcilablePaymentAttemptError();
  }

  return confirmOnlinePayment(target.returnToken, dbHandle);
}

async function recordAnomaly(
  dbHandle: DbHandle,
  paymentId: string,
  orderId: string,
  reason: string,
) {
  await dbHandle.insert(orderEvents).values({
    orderId,
    type: "PAYMENT_ANOMALY_DETECTED",
    actorType: "SYSTEM",
    adminUserId: null,
    metadata: { paymentId, reason },
  });
}

/**
 * Gate 11B — assembles the ONLINE_PAID-variant confirmation email
 * content from a FRESH post-commit read of the order/items (never
 * reused from inside the locked transaction — see the call site's
 * `dbHandle === db` comment for why this read happens after commit).
 * Order items are immutable once created (BR-PRO-002/BR-PRI-003), so
 * this re-read cannot observe a different commercial state than the
 * one that was just paid; only a seller reassignment racing this exact
 * instant could theoretically show a different seller than the one
 * present at payment time — a cosmetic, non-financial edge case, not a
 * correctness concern.
 */
async function buildOnlinePaymentConfirmationEmailInput(
  dbHandle: Pick<typeof db, "select">,
  orderId: string,
  method: "TWINT" | "CARD",
): Promise<OrderConfirmationEmailInput | null> {
  const [order] = await dbHandle.select().from(orders).where(eq(orders.id, orderId));
  if (!order) {
    return null;
  }
  const items = await dbHandle.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  let sellerName: string | null = null;
  if (order.sellerId) {
    const [seller] = await dbHandle.select().from(sellers).where(eq(sellers.id, order.sellerId));
    if (seller) {
      sellerName = formatSellerName(seller);
    }
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      customerAddress: order.customerAddress,
      customerPostalCode: order.customerPostalCode,
      customerCity: order.customerCity,
      deliveryNote: order.deliveryNote,
      totalAmount: order.totalAmount,
    },
    items: items.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
    })),
    paymentMethod: method,
    sellerName,
  };
}

type ApplySuccessTransactionResult =
  | { status: "SUCCEEDED"; justTransitioned: false }
  | { status: "SUCCEEDED"; justTransitioned: true; orderId: string; method: "TWINT" | "CARD" }
  | { status: "PROCESSING" };

/**
 * The single authoritative, concurrency-safe success transaction (Gate
 * 10B §16). `SELECT ... FOR UPDATE` on the Payment row serializes two
 * near-simultaneous confirmations of the SAME attempt (e.g. a browser
 * refresh racing a retry) so only one ever applies the transition;
 * the other observes the already-SUCCEEDED row and returns the same
 * result idempotently. `payment_events`' pre-existing
 * `unique(provider, providerEventId)` constraint — keyed here on
 * Saferpay's own `Transaction.Id`, a genuinely provider-issued stable
 * identifier, never a fabricated one (Gate 10B §14) — is the second,
 * independent backstop.
 *
 * Gate 11B: the inner transaction distinguishes an idempotent
 * "already SUCCEEDED" observation from the ONE call that genuinely
 * performs the transition (`justTransitioned`) — only the latter is
 * eligible for the post-commit confirmation email dispatched below,
 * after the transaction has resolved. This is the same row lock that
 * already made the transition itself exactly-once; no separate
 * locking primitive is introduced for email.
 */
async function applySuccessfulOnlinePayment(
  dbHandle: DbHandle,
  paymentId: string,
  successDetails: Extract<SaferpayAssertOutcome, { kind: "success" }> & SaferpaySuccessDetails,
): Promise<"SUCCEEDED" | "PROCESSING"> {
  const result: ApplySuccessTransactionResult = await dbHandle.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .for("update");
    if (!payment) {
      throw new PaymentAttemptNotFoundError();
    }
    if (payment.status === "SUCCEEDED") {
      return { status: "SUCCEEDED", justTransitioned: false };
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .for("update");
    if (!order) {
      throw new OrderNotFoundError(payment.orderId);
    }

    const siblingPayments = await tx.select().from(payments).where(eq(payments.orderId, order.id));
    const anotherAlreadySucceeded = siblingPayments.some(
      (candidate) => candidate.id !== payment.id && candidate.status === "SUCCEEDED",
    );
    if (anotherAlreadySucceeded) {
      // A different attempt already paid this Order — accepting a
      // second "success" here would be a financial anomaly, never
      // silently accepted (docs/08-PAYMENTS.md §57).
      await recordAnomaly(
        tx,
        payment.id,
        order.id,
        "duplicate-success-another-attempt-already-paid",
      );
      return { status: "PROCESSING" };
    }

    if (!canConfirmOnlinePaymentSuccess(order, payment)) {
      return { status: "PROCESSING" };
    }

    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "SUCCEEDED", paidAt: now, providerPaymentId: successDetails.transactionId })
      .where(eq(payments.id, payment.id));

    await tx
      .update(orders)
      .set({ customerPaymentStatus: "PAID", status: "CONFIRMED", confirmedAt: now })
      .where(eq(orders.id, order.id));

    await tx.insert(orderEvents).values({
      orderId: order.id,
      type: "PAYMENT_CONFIRMED_BY_PROVIDER",
      actorType: "PAYMENT_PROVIDER",
      adminUserId: null,
      metadata: {
        provider: "SAFERPAY",
        transactionId: successDetails.transactionId,
        method: successDetails.paymentMethod,
      },
    });

    // A genuine SAVEPOINT, not a plain try/catch around the insert
    // directly: a caught JS exception does not by itself "un-abort" the
    // underlying Postgres transaction once a statement inside it has
    // failed — only a real SAVEPOINT/ROLLBACK TO SAVEPOINT does. Same
    // pattern as `settlements.ts`'s nested-savepoint unique-violation
    // recovery.
    try {
      await tx.transaction(async (savepoint) => {
        await savepoint.insert(paymentEvents).values({
          paymentId: payment.id,
          provider: "SAFERPAY",
          providerEventId: successDetails.transactionId,
          eventType: "PAYMENT_PAGE_ASSERT_SUCCESS",
          processedAt: now,
          processingResult: "applied",
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error, "payment_events_provider_event_unique")) {
        throw error;
      }
    }

    // `payment.method` is always TWINT/CARD for a SAFERPAY attempt —
    // `initiateOnlinePayment()` only ever accepts those two values when
    // creating this row; SELLER payments never reach this function.
    return {
      status: "SUCCEEDED",
      justTransitioned: true,
      orderId: order.id,
      method: payment.method as "TWINT" | "CARD",
    };
  });

  // Gate 11B — automatic ONLINE_PAID confirmation email, only for the
  // ONE call that genuinely performed the transition above (never the
  // idempotent "already SUCCEEDED" observation Return/Notify/admin
  // reconciliation retries would otherwise repeatedly trigger).
  //
  // `dbHandle === db`: external post-commit side effects (the Resend
  // HTTP call) may only run when this function owns the durable
  // top-level DB handle. A `dbHandle` passed in by a caller (e.g. a
  // test's own transaction/savepoint) may still be rolled back by that
  // caller after this function returns — the "commit" `dbHandle.
  // transaction(...)` just resolved from would then never have
  // genuinely happened, and dispatching email off the back of it would
  // be observing a transition that, from the database's perspective,
  // never occurred.
  if (result.status === "SUCCEEDED" && result.justTransitioned && dbHandle === db) {
    try {
      const emailInput = await buildOnlinePaymentConfirmationEmailInput(
        dbHandle,
        result.orderId,
        result.method,
      );
      if (emailInput) {
        await dispatchOrderConfirmationEmail(dbHandle, result.orderId, emailInput);
      }
    } catch {
      // Never let a failure here (re-read, send, or event recording)
      // escape into the caller — the payment/order transition already
      // committed successfully and must be returned as such regardless
      // (docs/05-ARCHITECTURE.md §30).
    }
  }

  return result.status;
}
