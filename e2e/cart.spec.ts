import { expect, test } from "@playwright/test";

// Phase 6: browser coverage for the customer cart against the real
// seeded catalog the dev server (playwright.config.ts's webServer)
// already serves. Unlike public-catalog.spec.ts / admin-catalog.spec.ts,
// nothing here touches the database — the cart itself is entirely
// client-side (localStorage), and campaign-scoped reconciliation is
// exercised by injecting a fake stored cart via `addInitScript` rather
// than mutating the shared campaign row, so this file needs no DB
// import and no serial/restore dance. Each Playwright test already gets
// its own isolated browser context (no shared storageState is
// configured), so localStorage never leaks between tests.

const CART_STORAGE_KEY = "melodia:cart";

test("customer can add a wine and a bundle, review /panier, adjust quantities, and see checkout disabled", async ({
  page,
}) => {
  await page.goto("/");

  // Add the first wine (Chasselas, displayOrder 0) directly from the catalog row.
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await expect(page.getByRole("link", { name: "Panier, 1 article" })).toBeVisible();

  // Add the Discovery Box bundle.
  const discoveryBox = page.getByRole("region", { name: "Cartons découverte" });
  await discoveryBox.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("link", { name: "Panier, 2 articles" })).toBeVisible();

  await page.goto("/panier");
  await expect(page.getByRole("heading", { name: "Panier", level: 1 })).toBeVisible();

  // Both lines present with live catalog prices, not anything persisted client-side.
  await expect(page.getByText("Chasselas", { exact: true })).toBeVisible();
  await expect(page.getByText("Carton découverte", { exact: true })).toBeVisible();
  await expect(page.getByText("CHF 138.–", { exact: true })).toBeVisible(); // 18 + 120

  // Raise the Chasselas quantity from 1 to 3.
  const increaseChasselas = page.getByRole("button", {
    name: "Augmenter la quantité de Chasselas",
  });
  await increaseChasselas.click();
  await increaseChasselas.click();
  await expect(page.getByText("CHF 174.–", { exact: true })).toBeVisible(); // 3*18 + 120
  await expect(page.getByRole("link", { name: "Panier, 4 articles" })).toBeVisible();

  // Refresh: the server re-fetches the catalog, but the cart itself must survive via localStorage.
  await page.reload();
  await expect(page.getByText("CHF 174.–", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Panier, 4 articles" })).toBeVisible();

  // Remove the bundle line entirely.
  await page.getByRole("button", { name: "Retirer Carton découverte du panier" }).click();
  await expect(page.getByText("Carton découverte", { exact: true })).not.toBeVisible();
  // The line total and the overall total are now the same figure (one line left) — both legitimately on screen.
  await expect(page.getByText("CHF 54.–", { exact: true })).toHaveCount(2); // 3*18, line + total
  await expect(page.getByRole("link", { name: "Panier, 3 articles" })).toBeVisible();

  // Checkout now exists (Phase 7) — "Passer la commande" links to /commande.
  await expect(page.getByRole("link", { name: "Passer la commande" })).toBeVisible();
});

test("decrementing a line's quantity to zero removes it (BR-CART-003)", async ({ page }) => {
  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/panier");

  await expect(page.getByText("Chasselas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Diminuer la quantité de Chasselas" }).click();
  await expect(page.getByText("Chasselas", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Votre panier est vide.")).toBeVisible();
});

test("an empty cart shows a calm notice, never a blank/broken totals block", async ({ page }) => {
  await page.goto("/panier");
  await expect(page.getByRole("heading", { name: "Panier", level: 1 })).toBeVisible();
  await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Découvrir les vins" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Passer la commande" })).not.toBeVisible();
});

test("a malformed stored cart is discarded without crashing the page", async ({ page }) => {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: CART_STORAGE_KEY,
    value: "not valid json{",
  });

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/panier");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a cart stored under a different, already-known campaign is discarded on load — never merged", async ({
  page,
}) => {
  const staleCart = {
    version: 1,
    campaignId: "stale-test-campaign-id-000",
    items: [{ type: "PRODUCT", id: "stale-test-product-id", quantity: 5 }],
  };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: CART_STORAGE_KEY,
    value: JSON.stringify(staleCart),
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Panier, 0 articles" })).toBeVisible();

  // Reconciliation happens across a couple of effect commits (hydrate,
  // then compare, then reset, then persist) — poll rather than reading
  // localStorage immediately after goto resolves.
  await expect
    .poll(async () => {
      const stored = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        CART_STORAGE_KEY,
      );
      return (JSON.parse(stored ?? "{}") as { campaignId?: string }).campaignId;
    })
    .not.toBe("stale-test-campaign-id-000");

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
  const parsed = JSON.parse(stored ?? "{}");
  expect(parsed.items).toEqual([]);
});
