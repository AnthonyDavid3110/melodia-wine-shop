import "server-only";
import * as resendProvider from "./resend-provider";
import * as fakeTestProvider from "./fake-test-provider";
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
): Promise<SendEmailSuccess> {
  const content = buildOrderConfirmationEmail(input);
  return getProvider().sendEmail({
    to: input.order.customerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}
