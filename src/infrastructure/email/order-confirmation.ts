import "server-only";
// Type-only — `dispatchOrderConfirmationEmail()` below never touches the
// real `db` value, only its shape (`EventDbHandle`). A value import
// would make this module require a live DATABASE_URL just to load
// (see `client.ts`'s eager module-level check), which would break
// importing it from a plain (non-DB) unit test — exactly the hazard
// already documented for `online-payments.ts` in
// `src/app/api/payments/saferpay/notify/[token]/route.test.ts`.
import type { db } from "../database/client";
import { orderEvents } from "../database/schema";
import * as resendProvider from "./resend-provider";
import * as fakeTestProvider from "./fake-test-provider";
import {
  EmailConfigurationError,
  EmailNetworkError,
  EmailProviderRejectedError,
} from "./resend-provider";
import type { EmailProvider, SendEmailSuccess } from "./email-provider";
import {
  buildOrderConfirmationEmail,
  type OrderConfirmationEmailInput,
} from "@/domain/email/order-confirmation-content";

/**
 * Double-gated test-provider seam (Phase 11 Gate 11A) — mirrors
 * `src/infrastructure/payments/online-payments.ts`'s `getProvider()`
 * exactly. The fake provider is selected only when BOTH
 * `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_EMAIL_PROVIDER=true` opt-in are true — intended to be set
 * only in `playwright.config.ts`'s own `webServer.env`, once Gate 11B
 * adds Playwright coverage of actual dispatch, never in
 * `.env.example` or any real deployment configuration. Even a mistaken
 * production env var alone can never activate it. The return type
 * (`EmailProvider`) structurally forces both `resendProvider` and
 * `fakeTestProvider` to satisfy the same shape.
 */
function getProvider(): EmailProvider {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_EMAIL_PROVIDER === "true") {
    return fakeTestProvider;
  }
  return resendProvider;
}

/**
 * The one composed entry point Gate 11B will call: builds the
 * confirmation content from trusted persisted order data (pure — see
 * `domain/email/order-confirmation-content.ts`) and hands it to
 * whichever provider `getProvider()` selects.
 *
 * NOT called anywhere in Gate 11A, deliberately
 * (docs/10-IMPLEMENTATION-PLAN.md Phase 11 Gate 11A §22). Gate 11B
 * wires this into the two proven idempotent transition points —
 * `createOrder()`'s `"created"` result (never `"existing"`) for
 * seller-payment orders, and `applySuccessfulOnlinePayment()`'s real
 * state-transition branch (never its early "already SUCCEEDED"
 * return) for online orders — never into every retry/replay of those
 * paths. See the Gate 11A report's "Idempotency/concurrency
 * requirements" finding for why the placement matters.
 */
export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
  /**
   * Gate 11B defense-in-depth only (docs/08-PAYMENTS.md-style framing:
   * not a substitute for the DB-level exactly-once guarantee — see
   * `dispatchOrderConfirmationEmail()` below). Forwarded to the
   * provider's `Idempotency-Key`/equivalent mechanism when supported;
   * the fake test provider records it without using it for anything.
   */
  idempotencyKey?: string,
): Promise<SendEmailSuccess> {
  const content = buildOrderConfirmationEmail(input);
  return getProvider().sendEmail({
    to: input.order.customerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey,
  });
}

/** Safe, non-sensitive failure category for `EMAIL_FAILED` OrderEvent metadata — never the raw provider message/body. */
function classifyEmailFailure(
  error: unknown,
): "configuration" | "provider-rejected" | "network" | "unknown" {
  if (error instanceof EmailConfigurationError) {
    return "configuration";
  }
  if (error instanceof EmailProviderRejectedError) {
    return "provider-rejected";
  }
  if (error instanceof EmailNetworkError) {
    return "network";
  }
  return "unknown";
}

type EventDbHandle = Pick<typeof db, "insert">;

/**
 * Gate 11B — the one shared "send + record" step used by both dispatch
 * paths (`createOrder()`'s SELLER-payment transition and
 * `applySuccessfulOnlinePayment()`'s ONLINE-payment transition). Must
 * be called only after the caller's own business transaction has
 * genuinely, durably committed — never from inside an open transaction
 * (see the `dbHandle === db` guards at each call site).
 *
 * Never throws: neither a failed send nor a failed OrderEvent write may
 * ever escape into a caller whose order/payment success has already
 * committed and must stand regardless (docs/05-ARCHITECTURE.md §30).
 * A stable, non-PII idempotency key (`order-confirmation/<orderId>`) is
 * passed through as defense-in-depth only — the actual exactly-once
 * guarantee is the DB-level transition gating at each call site, not
 * this key; see the Gate 11B report for the documented remaining crash
 * windows this does NOT close.
 */
export async function dispatchOrderConfirmationEmail(
  dbHandle: EventDbHandle,
  orderId: string,
  input: OrderConfirmationEmailInput,
): Promise<void> {
  const variant = input.paymentMethod === "SELLER" ? "SELLER_PAYMENT" : "ONLINE_PAID";
  const idempotencyKey = `order-confirmation/${orderId}`;

  let type: "EMAIL_SENT" | "EMAIL_FAILED" = "EMAIL_SENT";
  let category: string | undefined;
  try {
    await sendOrderConfirmationEmail(input, idempotencyKey);
  } catch (error) {
    type = "EMAIL_FAILED";
    category = classifyEmailFailure(error);
  }

  try {
    await dbHandle.insert(orderEvents).values({
      orderId,
      type,
      actorType: "SYSTEM",
      adminUserId: null,
      metadata:
        type === "EMAIL_SENT"
          ? { emailType: "ORDER_CONFIRMATION", variant }
          : { emailType: "ORDER_CONFIRMATION", variant, category },
    });
  } catch {
    // Recording the audit event failed — never let this escape either.
    // The send attempt above already happened (or failed) on its own
    // terms, and the underlying order/payment result already committed
    // and must stand regardless of this write's outcome.
  }
}
