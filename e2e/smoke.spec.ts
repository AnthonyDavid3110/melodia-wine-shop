import { expect, test } from "@playwright/test";

// Phase 0 smoke test: verifies the app boots and serves a page.
// The default Next.js starter content is still in place — this test will be
// replaced once the real campaign homepage is implemented (Phase 5).
test("homepage responds and renders", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Create Next App");
});
