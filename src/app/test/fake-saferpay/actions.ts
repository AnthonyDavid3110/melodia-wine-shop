"use server";

import { redirect } from "next/navigation";
import { getFakeAttempt, resolveFakeAttempt } from "@/infrastructure/payments/fake-test-provider";

/**
 * Test-only — resolves a fake payment attempt and redirects back to the
 * real ReturnUrl, exactly mirroring Saferpay's own browser-redirect
 * behavior (Gate 10B §25/§29). Guarded the same way as the page itself;
 * see fake-test-provider.ts's doc comment for the full gating story.
 */
export async function resolveFakePaymentAction(
  token: string,
  outcome: "success" | "declined" | "aborted",
) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_FAKE_PAYMENT_PROVIDER !== "true") {
    throw new Error("Not available.");
  }

  const attempt = getFakeAttempt(token);
  if (!attempt) {
    throw new Error("Unknown fake payment attempt.");
  }

  resolveFakeAttempt(token, outcome);
  redirect(attempt.returnUrl);
}

/**
 * Gate 10C-B1 test-only helper — resolves the fake provider's outcome
 * WITHOUT redirecting the browser to `returnUrl`, so a Playwright test
 * can then fire the real notify route directly (e.g.
 * `page.request.get(notifyUrl)`), proving reconciliation works without
 * the browser ever visiting `/commande/retour`. Same double gate as
 * every other fake-provider entry point.
 */
export async function resolveFakePaymentNoRedirectAction(
  token: string,
  outcome: "success" | "declined" | "aborted",
): Promise<void> {
  if (process.env.NODE_ENV === "production" || process.env.E2E_FAKE_PAYMENT_PROVIDER !== "true") {
    throw new Error("Not available.");
  }

  const attempt = getFakeAttempt(token);
  if (!attempt) {
    throw new Error("Unknown fake payment attempt.");
  }

  resolveFakeAttempt(token, outcome);
}
