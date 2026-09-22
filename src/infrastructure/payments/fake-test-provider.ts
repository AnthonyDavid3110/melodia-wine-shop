import "server-only";
import { randomUUID } from "node:crypto";
import type { InitializePaymentPageInput, InitializePaymentPageResult } from "./saferpay-client";
import type {
  SaferpayAssertOutcome,
  SaferpayCaptureOutcome,
} from "@/domain/payments/normalize-saferpay-outcome";

/**
 * Test-only fake Saferpay provider (Phase 10 Gate 10B §25/§29) — same
 * function signatures as `saferpay-client.ts`, so
 * `src/infrastructure/payments/online-payments.ts` can use either
 * without knowing which. Exists purely so Playwright can drive a real
 * browser through the real redirect/return flow deterministically,
 * without any live Saferpay network call. Never exposed as a customer
 * payment option and never reachable in production — see the
 * double-gated selection in `online-payments.ts` (requires both
 * `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_PAYMENT_PROVIDER=true` opt-in Playwright's own config sets)
 * and the matching guard on `/test/fake-saferpay`, the only page that
 * can resolve an outcome.
 *
 * State lives in a module-level Map — acceptable only because this is
 * test infrastructure for a single-process local/CI dev server, never
 * production (which would need a real datastore and, more importantly,
 * would never load this module at all).
 */

interface FakeAttempt {
  returnUrl: string;
  /** Gate 10C-B1 — the real notify route URL, so Playwright can fire it directly (e.g. `page.request.get()`) without ever visiting `returnUrl`. */
  notifyUrl: string;
  amountValue: string;
  paymentMethod: string;
  outcome: "pending" | "success" | "declined" | "aborted";
}

/**
 * Gate 10C-B1: stored on `globalThis`, not a plain module-level
 * `const` — under Next.js dev mode (Turbopack), a Route Handler
 * (`src/app/api/.../route.ts`) and a Server Action/page
 * (`src/app/test/fake-saferpay/{page,actions}.tsx`) can each get their
 * OWN instantiation of this module's top-level scope, so a plain
 * module-level Map is silently NOT shared between the notify route and
 * the fake page/actions that mutate it — discovered via a real
 * Playwright run where the notify route consistently observed a fake
 * attempt still "pending" immediately after the page's action had
 * already (verifiably, via server-side logging) set it to "success".
 * `globalThis` is the one thing guaranteed to be the same object
 * across every module instantiation in the same Node process,
 * regardless of which Next.js runtime "kind" a given entry point is
 * bundled under — the same pattern commonly used to keep a single
 * PrismaClient instance alive across Next.js dev-mode hot reloads.
 */
const globalForFakeProvider = globalThis as unknown as {
  __fakeSaferpayAttempts?: Map<string, FakeAttempt>;
};
if (!globalForFakeProvider.__fakeSaferpayAttempts) {
  globalForFakeProvider.__fakeSaferpayAttempts = new Map<string, FakeAttempt>();
}
const attempts: Map<string, FakeAttempt> = globalForFakeProvider.__fakeSaferpayAttempts;

export async function initializePaymentPage(
  input: InitializePaymentPageInput,
): Promise<InitializePaymentPageResult> {
  const token = `fake-token-${randomUUID()}`;
  attempts.set(token, {
    returnUrl: input.returnUrl,
    notifyUrl: input.notifyUrl,
    amountValue: String(input.amount),
    paymentMethod: input.paymentMethods[0] ?? "TWINT",
    outcome: "pending",
  });

  return {
    token,
    redirectUrl: `/test/fake-saferpay?token=${encodeURIComponent(token)}`,
    expiration: new Date(Date.now() + 15 * 60_000),
  };
}

export async function assertPaymentPage(token: string): Promise<SaferpayAssertOutcome> {
  const attempt = attempts.get(token);
  if (!attempt) {
    return { kind: "unrecognized", detail: "unknown fake token" };
  }

  switch (attempt.outcome) {
    case "pending":
      return { kind: "pending" };
    case "aborted":
      return { kind: "aborted" };
    case "declined":
      return {
        kind: "declined",
        errorName: "TRANSACTION_DECLINED",
        message: "Simulated decline (fake test provider).",
      };
    case "success":
      // Gate 10C-A: modeled as AUTHORIZED, matching what the real
      // Saferpay TEST smoke test actually observed — so Playwright
      // exercises the full Assert(AUTHORIZED) -> capturePayment() ->
      // SUCCEEDED path, not just the CAPTURED-direct shortcut.
      return {
        kind: "success",
        providerStatus: "AUTHORIZED",
        transactionId: `fake-txn-${token}`,
        amountValue: attempt.amountValue,
        currencyCode: "CHF",
        paymentMethod: attempt.paymentMethod,
      };
  }
}

/**
 * Fake `Transaction/Capture` (Gate 10C-A) — mirrors the real endpoint's
 * shape closely enough to exercise `online-payments.ts`'s capture
 * branch end-to-end in Playwright. `transactionId` follows the
 * `fake-txn-${token}` convention set above, so the originating attempt
 * can be found without a second map.
 */
export async function capturePayment(transactionId: string): Promise<SaferpayCaptureOutcome> {
  const token = transactionId.replace(/^fake-txn-/, "");
  const attempt = attempts.get(token);
  if (!attempt) {
    return { kind: "unrecognized", detail: "unknown fake transaction id" };
  }
  return { kind: "captured", captureId: `fake-capture-${token}` };
}

/** Looked up by /test/fake-saferpay to render the fake payment page and return the real ReturnUrl to redirect back to. */
export function getFakeAttempt(token: string): FakeAttempt | undefined {
  return attempts.get(token);
}

/** Called by /test/fake-saferpay's own action when the developer/test clicks a simulated outcome button. */
export function resolveFakeAttempt(
  token: string,
  outcome: "success" | "declined" | "aborted",
): void {
  const attempt = attempts.get(token);
  if (attempt) {
    attempt.outcome = outcome;
  }
}
