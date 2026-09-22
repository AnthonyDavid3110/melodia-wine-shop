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
