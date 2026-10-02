import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * `online-payments.ts` imports `db` from `../database/client` as a
 * VALUE (used as `initiateOnlinePayment`'s/`confirmOnlinePayment`'s
 * default `dbHandle` parameter) — unlike `order-confirmation.ts`'s
 * type-only `db` import, this triggers `client.ts`'s unconditional
 * module-load-time `if (!serverEnv.DATABASE_URL) throw`. This test
 * only exercises `isOnlinePaymentAvailable()`, which never touches
 * `db` at all, so the real export is never dereferenced — this mock
 * exists solely to let the module load in a DB-less unit-test process,
 * never to simulate database behavior (Gate 15A Step 2, approved).
 */
vi.mock("../database/client", () => ({ db: {} }));

/**
 * `isOnlinePaymentAvailable()`'s own guard
 * (`online-payments.ts`) and the private `getProvider()` it sits
 * beside use the textually identical expression:
 * `process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_PAYMENT_PROVIDER === "true"`.
 * This test proves that expression is production-safe via the
 * exported path — it does NOT execute `getProvider()` itself (private,
 * unexported, reachable only through `initiateOnlinePayment()`, which
 * requires a live DB transaction and is out of scope here). The
 * private provider-selection path shares the same audited guard by
 * direct code inspection (Gate 15A Step 1 §6/§7), not by this test.
 */

// `isSaferpayConfigured()` reads `serverEnv.SAFERPAY_*`, which is a
// module-level singleton built ONCE from `process.env` when `@/lib/env`
// is first imported — not re-read per call. Any real Saferpay
// configuration already present in this process's ambient environment
// (e.g. a developer's own exported shell variables) must be cleared
// BEFORE that first import, or `serverEnv` would freeze a stale "true"
// regardless of anything stubbed later in the test body.
const SAFERPAY_VARS = [
  "SAFERPAY_ENVIRONMENT",
  "SAFERPAY_CUSTOMER_ID",
  "SAFERPAY_TERMINAL_ID",
  "SAFERPAY_API_USERNAME",
  "SAFERPAY_API_PASSWORD",
] as const;
const originalSaferpayEnv = Object.fromEntries(SAFERPAY_VARS.map((key) => [key, process.env[key]]));
for (const key of SAFERPAY_VARS) {
  delete process.env[key];
}

const originalNodeEnv = process.env.NODE_ENV;
const originalOptIn = process.env.E2E_FAKE_PAYMENT_PROVIDER;

const { isOnlinePaymentAvailable } = await import("./online-payments");

afterEach(() => {
  vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
  if (originalOptIn === undefined) {
    delete process.env.E2E_FAKE_PAYMENT_PROVIDER;
  } else {
    process.env.E2E_FAKE_PAYMENT_PROVIDER = originalOptIn;
  }
  vi.unstubAllEnvs();
});

afterAll(() => {
  for (const key of SAFERPAY_VARS) {
    const original = originalSaferpayEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe("isOnlinePaymentAvailable — production safety (payment fake-provider guard)", () => {
  it("NEVER treats the fake provider as available in production, even with the opt-in set", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.E2E_FAKE_PAYMENT_PROVIDER = "true";

    // No Saferpay configuration is present (cleared above), so the
    // only way this could return true is the fake-provider opt-in
    // short-circuiting — which it must not do in production.
    expect(isOnlinePaymentAvailable()).toBe(false);
  });
});
