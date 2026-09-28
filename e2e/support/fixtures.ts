import { createHash } from "node:crypto";
import { test as base, expect } from "@playwright/test";

/**
 * Phase 14 Gate 14B: the local dev server has no reverse proxy setting
 * `x-forwarded-for`, so every Playwright request would otherwise collapse
 * onto the checkout/payment rate limiter's shared "unknown" fallback
 * identity, letting one spec's traffic exhaust another's quota. A
 * deterministic, syntactically-valid synthetic IPv4 per TEST (not merely
 * per file — a single file's own serial tests can already exceed a
 * bucket's limit) mirrors how distinct real customers naturally get
 * distinct IPs in production. Collisions are astronomically unlikely
 * (~90 tests over 16M+ addresses) and harmless even if they occurred.
 */
function syntheticClientIp(seed: string): string {
  const hash = createHash("sha256").update(seed).digest();
  return `10.14.${hash[0]}.${hash[1]}`;
}

export const test = base.extend({
  // Renamed from Playwright's conventional `use` parameter: eslint's
  // react-hooks plugin flags any function argument literally named `use`
  // as a suspected React Hook call, which this fixture is not.
  page: async ({ page }, provideFixture, testInfo) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": syntheticClientIp(testInfo.testId) });
    await provideFixture(page);
  },
});

export { expect };
