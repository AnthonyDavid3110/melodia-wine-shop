import { notFound } from "next/navigation";
import { getFakeAttempt } from "@/infrastructure/payments/fake-test-provider";
import { resolveFakePaymentAction, resolveFakePaymentNoRedirectAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Stands in for Saferpay's real hosted Payment Page during Playwright
 * e2e runs only (Gate 10B §25/§29) — never reachable outside a
 * `NODE_ENV !== "production"` process that also opted in via
 * `E2E_FAKE_PAYMENT_PROVIDER=true` (set only in playwright.config.ts's
 * `webServer.env`). A real customer, and any production deployment,
 * gets a 404 here unconditionally.
 */
export default async function FakeSaferpayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_FAKE_PAYMENT_PROVIDER !== "true") {
    notFound();
  }

  const { token } = await searchParams;
  const attempt = token ? getFakeAttempt(token) : undefined;
  if (!token || !attempt) {
    notFound();
  }

  return (
    <div
      style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif", padding: "0 1rem" }}
    >
      <h1>Fake Saferpay Payment Page (test only)</h1>
      <p>
        Amount: {attempt.amountValue} CHF — Method: {attempt.paymentMethod}
      </p>
      {/* Gate 10C-B1: rendered as plain text so a Playwright test can
          read the real return/notify URLs (sharing the same opaque
          token) before deciding whether to exercise the Return path,
          the Notify-only path, or both in either order. */}
      <p data-testid="return-url">Return URL: {attempt.returnUrl}</p>
      <p data-testid="notify-url">Notify URL: {attempt.notifyUrl}</p>
      <form action={resolveFakePaymentAction.bind(null, token, "success")}>
        <button type="submit">Simulate success</button>
      </form>
      <form action={resolveFakePaymentAction.bind(null, token, "declined")}>
        <button type="submit">Simulate decline</button>
      </form>
      <form action={resolveFakePaymentAction.bind(null, token, "aborted")}>
        <button type="submit">Simulate cancel</button>
      </form>
      <p>Resolve without visiting the return page (Notify-only scenarios):</p>
      <form action={resolveFakePaymentNoRedirectAction.bind(null, token, "success")}>
        <button type="submit">Simulate success (no redirect)</button>
      </form>
      <form action={resolveFakePaymentNoRedirectAction.bind(null, token, "declined")}>
        <button type="submit">Simulate decline (no redirect)</button>
      </form>
      <form action={resolveFakePaymentNoRedirectAction.bind(null, token, "aborted")}>
        <button type="submit">Simulate cancel (no redirect)</button>
      </form>
    </div>
  );
}
