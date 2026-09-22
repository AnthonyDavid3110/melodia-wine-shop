import { notFound } from "next/navigation";
import { getFakeAttempt } from "@/infrastructure/payments/fake-test-provider";
import { resolveFakePaymentAction } from "./actions";

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
      <form action={resolveFakePaymentAction.bind(null, token, "success")}>
        <button type="submit">Simulate success</button>
      </form>
      <form action={resolveFakePaymentAction.bind(null, token, "declined")}>
        <button type="submit">Simulate decline</button>
      </form>
      <form action={resolveFakePaymentAction.bind(null, token, "aborted")}>
        <button type="submit">Simulate cancel</button>
      </form>
    </div>
  );
}
