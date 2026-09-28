import { expect, test } from "./support/fixtures";

// Phase 14 Gate 14C: HTTP security headers / CSP are applied globally via
// next.config.ts's headers() (src/lib/security-headers.ts). This file
// verifies real HTTP responses carry the policy — a header-string unit
// test alone can't prove Next.js's `headers()` config is actually wired
// up and applied to real routes. No DB state is created; every assertion
// reads response headers only, on routes other specs already exercise.

test.describe.configure({ mode: "serial" });

const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];

test("a public route carries the full security-header set", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  const headers = response?.headers() ?? {};
  for (const name of REQUIRED_HEADERS) {
    expect(headers[name], `missing header: ${name}`).toBeTruthy();
  }
});

test("an admin route (including its unauthenticated redirect) carries the full security-header set", async ({
  page,
}) => {
  const response = await page.goto("/admin");
  const headers = response?.headers() ?? {};
  for (const name of REQUIRED_HEADERS) {
    expect(headers[name], `missing header: ${name}`).toBeTruthy();
  }
});

test("Content-Security-Policy has no wildcard source and denies framing", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).not.toContain("*");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
});

test("X-Content-Type-Options is exactly nosniff", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
});

test("Referrer-Policy is the deliberately chosen strict-origin-when-cross-origin", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("Permissions-Policy denies camera, microphone and geolocation", async ({ page }) => {
  const response = await page.goto("/");
  const policy = response?.headers()["permissions-policy"] ?? "";
  expect(policy).toContain("camera=()");
  expect(policy).toContain("microphone=()");
  expect(policy).toContain("geolocation=()");
});

test("X-Frame-Options is DENY, defense-in-depth alongside frame-ancestors", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
});
