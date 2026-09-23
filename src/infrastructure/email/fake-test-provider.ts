import "server-only";
import { randomUUID } from "node:crypto";
import type { SendEmailInput, SendEmailSuccess } from "./resend-provider";

/**
 * Test-only fake email provider (Phase 11 Gate 11A) — same function
 * signature as `resend-provider.ts`, so
 * `src/infrastructure/email/order-confirmation.ts` can use either
 * without knowing which, mirroring
 * `src/infrastructure/payments/fake-test-provider.ts`'s safety model
 * exactly. Exists so Playwright (from Gate 11B onward) can assert what
 * would have been sent, deterministically, without any real Resend
 * network call and without any real credentials. Never exposed as a
 * customer-facing capability and never reachable in production — see
 * the double gate in `order-confirmation.ts`'s `getProvider()`
 * (requires both `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_EMAIL_PROVIDER=true` opt-in).
 *
 * State lives in a module-level array keyed on `globalThis`, not a
 * plain module-level `const` — under Next.js dev mode (Turbopack), a
 * Route Handler/Server Action can otherwise get its OWN instantiation
 * of this module's top-level scope, so a plain array would silently
 * not be shared between the code that sends and the test code that
 * inspects what was sent. Same documented hazard and same fix as
 * `src/infrastructure/payments/fake-test-provider.ts`.
 */

export interface SentTestEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: Date;
}

const globalForFakeEmailProvider = globalThis as unknown as {
  __fakeSentEmails?: SentTestEmail[];
};
if (!globalForFakeEmailProvider.__fakeSentEmails) {
  globalForFakeEmailProvider.__fakeSentEmails = [];
}
const sentEmails: SentTestEmail[] = globalForFakeEmailProvider.__fakeSentEmails;

/** Same signature as `resend-provider.ts`'s `sendEmail` — never throws, always "succeeds," records the attempt for later inspection. No network. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailSuccess> {
  const id = randomUUID();
  sentEmails.push({
    id,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    sentAt: new Date(),
  });
  return { messageId: id };
}

/** Test-only inspection helper — never imported by application/domain code, only by tests. */
export function getSentTestEmails(): readonly SentTestEmail[] {
  return sentEmails;
}

/** Test-only reset helper, so each test starts from a clean slate regardless of module-instance sharing. */
export function resetSentTestEmails(): void {
  sentEmails.length = 0;
}
