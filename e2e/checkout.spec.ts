import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 7: browser coverage for the real public checkout flow against
// the shared seeded campaign/products the dev server (playwright.config.ts's
// webServer) uses. Unlike Phase 6's cart suite, checkout DOES write real
// committed rows (Order/OrderItem/Payment/OrderEvent) — every test
// tracks the customer email it used and `afterAll` deletes everything
// created under those emails, RESTRICT-safe child-before-parent, so
// repeated runs stay deterministic regardless of pass/fail.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const { orders, orderItems, orderBundleComponents, payments, orderEvents } =
  await import("../src/infrastructure/database/schema");
const { inArray } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const usedEmails: string[] = [];
function testEmail(label: string): string {
  const email = `${unique(label)}@example.test`;
  usedEmails.push(email);
  return email;
}

// Tracked as soon as each admin identity is created (not at the end of
// a test body) so a mid-test failure still leaves it queued for
// cleanup here — a cleanup step placed only at the end of a test body
// is skipped entirely when that test throws before reaching it.
const createdAdminEmails: string[] = [];
async function createAndLogInAsTestAdmin(page: import("@playwright/test").Page, label: string) {
  const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");
  const email = `${unique(label)}@example.test`;
  createdAdminEmails.push(email);
  await bootstrapAdmin({ email, name: `E2E ${label}`, password: "correct-horse-battery-1" });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      const matchingItems = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
      const itemIds = matchingItems.map((item) => item.id);
      if (itemIds.length > 0) {
        await db
          .delete(orderBundleComponents)
          .where(inArray(orderBundleComponents.orderItemId, itemIds));
      }
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(payments).where(inArray(payments.orderId, orderIds));
      await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
  }

  if (createdAdminEmails.length > 0) {
    const { adminUsers, authUsers, authSessions, authAccounts } =
      await import("../src/infrastructure/database/schema");
    for (const email of createdAdminEmails) {
      await db.delete(adminUsers).where(inArray(adminUsers.email, [email]));
      const [authUser] = await db
        .select()
        .from(authUsers)
        .where(inArray(authUsers.email, [email]));
      if (authUser) {
        await db.delete(authSessions).where(inArray(authSessions.userId, [authUser.id]));
        await db.delete(authAccounts).where(inArray(authAccounts.userId, [authUser.id]));
        await db.delete(authUsers).where(inArray(authUsers.id, [authUser.id]));
      }
    }
  }
});

async function fillCustomerFields(page: import("@playwright/test").Page, email: string) {
  await page.fill("#customerFirstName", "Jean");
  await page.fill("#customerLastName", "Testeur");
  await page.fill("#customerAddress", "Rue Example 1");
  await page.fill("#customerPostalCode", "1000");
  await page.fill("#customerCity", "Lausanne");
  await page.fill("#customerEmail", email);
  await page.fill("#customerPhone", "+41 79 000 00 00");
}

test("realistic end-to-end flow: catalog, cart, checkout, confirmation, cart cleared, then found in admin", async ({
  page,
}) => {
  // Several routes here (/commande, /admin/commandes, /admin/commandes/[id])
  // are visited for the first time in this run — Turbopack dev
  // compiles each route on first visit, which can exceed the default
  // test timeout (same class of slowness admin-catalog.spec.ts already
  // works around).
  test.setTimeout(60000);
  const email = testEmail("checkout-full-flow");

  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  const discoveryBox = page.getByRole("region", { name: "Cartons découverte" });
  await discoveryBox.getByRole("button", { name: "Ajouter" }).click();

  await page.goto("/panier");
  await page.getByRole("link", { name: "Passer la commande" }).click();
  await expect(page).toHaveURL(/\/commande$/);

  await fillCustomerFields(page, email);
  // Continue without a seller (the default state — Combobox untouched).
  await page.getByRole("button", { name: "Confirmer la commande" }).click();

  await expect(page.getByText("COMMANDE CONFIRMÉE")).toBeVisible();
  // Two <h1>s exist on this page: the static page title ("Commande")
  // and the confirmation view's own order-number heading — the latter
  // is always the last one once confirmation replaces the form.
  const orderNumberText = await page.getByRole("heading", { level: 1 }).last().innerText();
  expect(orderNumberText).toMatch(/^ECM-\d{4}-\d{4,}$/);
  await expect(page.getByText("Paiement au membre lors de la livraison")).toBeVisible();

  // Cart was cleared only after success.
  const cartStorage = await page.evaluate(() => window.localStorage.getItem("melodia:cart"));
  const parsedCart = JSON.parse(cartStorage ?? "{}");
  expect(parsedCart.items).toEqual([]);

  // Find it in admin.
  await createAndLogInAsTestAdmin(page, "checkout-admin");

  await page.goto("/admin/commandes", { waitUntil: "networkidle" });
  // Search matches order number/customer/seller, not email.
  await page.getByPlaceholder("N° de commande, client, vendeur…").fill("Jean Testeur");
  await expect(page.getByRole("link", { name: orderNumberText })).toBeVisible();

  await page.getByRole("link", { name: orderNumberText }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/.+/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: orderNumberText, level: 1 })).toBeVisible();
  // Scoped to `.first()`: Phase 9's fulfilment progression on this same
  // page also renders a "Confirmée" step label, so the bare text now
  // matches twice — this asserts the order-header status badge
  // specifically, which renders first in DOM order.
  await expect(page.getByText("Confirmée").first()).toBeVisible();
  await expect(page.locator('input[name="customerEmail"]')).toHaveValue(email);
});

test("checkout without a seller succeeds — order remains unassigned", async ({ page }) => {
  const email = testEmail("checkout-no-seller");

  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande");
  await fillCustomerFields(page, email);
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByText("COMMANDE CONFIRMÉE")).toBeVisible();
});

test("an empty cart cannot reach checkout submission — shows the empty-cart notice instead", async ({
  page,
}) => {
  await page.goto("/commande");
  await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer la commande" })).not.toBeVisible();
});

test("a validation failure preserves the cart and already-entered field values", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande");

  // Malformed email, everything else valid.
  await page.fill("#customerFirstName", "Jean");
  await page.fill("#customerLastName", "Testeur");
  await page.fill("#customerAddress", "Rue Example 1");
  await page.fill("#customerPostalCode", "1000");
  await page.fill("#customerCity", "Lausanne");
  await page.fill("#customerEmail", "not-an-email");
  await page.fill("#customerPhone", "+41 79 000 00 00");
  await page.getByRole("button", { name: "Confirmer la commande" }).click();

  // Still on the checkout page, not confirmed, field value preserved for correction.
  await expect(page.getByText("COMMANDE CONFIRMÉE")).not.toBeVisible();
  await expect(page.locator("#customerEmail")).toHaveValue("not-an-email");
  await expect(page.locator("#customerFirstName")).toHaveValue("Jean");

  // Cart survived the failed attempt.
  const cartStorage = await page.evaluate(() => window.localStorage.getItem("melodia:cart"));
  const parsedCart = JSON.parse(cartStorage ?? "{}");
  expect(parsedCart.items.length).toBeGreaterThan(0);
});

test("rapid double-submit (double click) creates only ONE order — the idempotency key + disabled submit both hold", async ({
  page,
}) => {
  const email = testEmail("checkout-double-submit");

  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande");
  await fillCustomerFields(page, email);

  // Two native clicks dispatched back-to-back in the same tick — not
  // Playwright's own `.click()` twice, which auto-waits/retries against
  // "visible, enabled, stable" and fights itself once the first click's
  // React state update disables/replaces the button (observed: the
  // second call spun retrying against a detaching element until the
  // test timeout, independent of app behavior). A raw double
  // `HTMLElement.click()` call is what a genuine double-click actually
  // dispatches, without Playwright's actionability polling getting in
  // the way of observing it.
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    button?.click();
    button?.click();
  });
  await expect(page.getByText("COMMANDE CONFIRMÉE")).toBeVisible();

  const matching = await db
    .select()
    .from(orders)
    .where(inArray(orders.customerEmail, [email]));
  expect(matching).toHaveLength(1);
});
