import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { orderEvents, orders, paymentEvents, payments } from "../database/schema";
import { OrderNotFoundError } from "../orders/orders";
import {
  canConfirmOnlinePaymentSuccess,
  canInitiateOnlinePayment,
  isActivePaymentAttempt,
} from "@/domain/payments/payment-guards";
import {
  normalizeSaferpayOutcome,
  type SaferpayAssertOutcome,
  type SaferpaySuccessDetails,
} from "@/domain/payments/normalize-saferpay-outcome";
import { type Money } from "@/domain/money";
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
function getProvider(): Pick<typeof saferpayClient, "initializePaymentPage" | "assertPaymentPage"> {
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
  returnUrlBase: string,
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
      if (isActivePaymentAttempt(existing)) {
        await tx.update(payments).set({ status: "CANCELLED" }).where(eq(payments.id, existing.id));
      }
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

  const returnUrl = `${returnUrlBase}?rt=${returnToken}`;
  const saferpayMethods =
    method === "TWINT" ? (["TWINT"] as const) : (["VISA", "MASTERCARD"] as const);

  let initialized;
  try {
    initialized = await getProvider().initializePaymentPage({
      amount,
      orderNumber,
      description: `Commande ${orderNumber} — Les Vins de Mélodia`,
      returnUrl,
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
}

/**
 * The trusted result-lookup used by the public return route (Gate 10B
 * §12/§15/§16) — safe to call repeatedly (browser refresh, a stray
 * duplicate notification ping, etc.). Never marks anything paid merely
 * because this function was invoked; it always asks Saferpay
 * (PaymentPage/Assert) for the authoritative result before applying any
 * state change, except when the local Payment is already terminal, in
 * which case it returns that terminal state directly without a
 * redundant provider call.
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
    return { status: "PROCESSING", orderNumber: order.orderNumber };
  }

  const normalized = normalizeSaferpayOutcome(outcome);

  if (normalized.status === "SUCCEEDED" && outcome.kind === "success") {
    if (outcome.currencyCode !== "CHF" || Number(outcome.amountValue) !== payment.amount) {
      await recordAnomaly(dbHandle, payment.id, order.id, "amount-or-currency-mismatch");
      return { status: "PROCESSING", orderNumber: order.orderNumber, anomaly: true };
    }
    const applied = await applySuccessfulOnlinePayment(dbHandle, payment.id, outcome);
    return { status: applied, orderNumber: order.orderNumber };
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
 */
async function applySuccessfulOnlinePayment(
  dbHandle: DbHandle,
  paymentId: string,
  successDetails: Extract<SaferpayAssertOutcome, { kind: "success" }> & SaferpaySuccessDetails,
): Promise<"SUCCEEDED" | "PROCESSING"> {
  return dbHandle.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .for("update");
    if (!payment) {
      throw new PaymentAttemptNotFoundError();
    }
    if (payment.status === "SUCCEEDED") {
      return "SUCCEEDED";
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
      return "PROCESSING";
    }

    if (!canConfirmOnlinePaymentSuccess(order, payment)) {
      return "PROCESSING";
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

    return "SUCCEEDED";
  });
}
