import { expect, test } from "@playwright/test";

// Phase 0 smoke test: verifies the app boots and serves a page. The
// real campaign homepage (Phase 4, e2e/public-catalog.spec.ts) has its
// own focused coverage — this stays a minimal boot canary, so it no
// longer asserts the create-next-app placeholder's literal title.
test("homepage responds and renders", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/.+/);
});
