import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 10 Gate 10B: browser coverage for the online (Saferpay) payment
// flow, driven entirely through the double-gated fake test provider
// (src/infrastructure/payments/fake-test-provider.ts,
// playwright.config.ts's webServer.env) — never the real Saferpay
// sandbox, matching §25/§29 of the gate ("do not make the regular
// Playwright suite depend on external Saferpay"). The real Saferpay
// sandbox smoke test is separate and manual (§30).
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  orders,
  orderItems,
  payments,
  paymentEvents,
  orderEvents,
  adminUsers,
  authUsers,
  authSessions,
  authAccounts,
} = await import("../src/infrastructure/database/schema");
const { eq, inArray } = await import("drizzle-orm");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const usedEmails: string[] = [];
function testEmail(label: string): string {
  const email = `${unique(label)}@example.test`;
  usedEmails.push(email);
  return email;
}

const createdAdminEmails: string[] = [];
async function createAndLogInAsTestAdmin(page: import("@playwright/test").Page, label: string) {
  const email = `${unique(label)}@example.test`;
  createdAdminEmails.push(email);
  await bootstrapAdmin({ email, name: `E2E ${label}`, password: "correct-horse-battery-1" });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
}

async function fillCustomerInfo(page: import("@playwright/test").Page, email: string) {
  await page.fill("#customerFirstName", "Marie");
  await page.fill("#customerLastName", "Paiement");
  await page.fill("#customerAddress", "Chemin du Paiement 7");
  await page.fill("#customerPostalCode", "1200");
  await page.fill("#customerCity", "Genève");
  await page.fill("#customerEmail", email);
  await page.fill("#customerPhone", "022 000 00 00");
}

async function startCheckoutWithMethod(
  page: import("@playwright/test").Page,
  email: string,
  method: "TWINT" | "Carte bancaire" | "SELLER",
) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande", { waitUntil: "networkidle" });
  await fillCustomerInfo(page, email);
  if (method !== "SELLER") {
    await page.getByLabel(method).click();
  }
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      const orderPayments = await db
        .select({ id: payments.id })
        .from(payments)
        .where(inArray(payments.orderId, orderIds));
      const paymentIds = orderPayments.map((p) => p.id);
      if (paymentIds.length > 0) {
        await db.delete(paymentEvents).where(inArray(paymentEvents.paymentId, paymentIds));
      }
      await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
      await db.delete(payments).where(inArray(payments.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
  }

  for (const email of createdAdminEmails) {
    await db.delete(adminUsers).where(eq(adminUsers.email, email));
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));
    if (authUser) {
      await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
      await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
    }
  }
});

test("realistic end-to-end flow: TWINT checkout, redirect, trusted simulated success, CONFIRMED + PAID", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("twint-success");

  await startCheckoutWithMethod(page, email, "TWINT");

  // The Order exists as NEW/PENDING the moment the browser is
  // redirected — never CONFIRMED/PAID merely because Initialize
  // succeeded or the browser was redirected (Gate 10B §4).
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  const [orderAfterRedirect] = await db
    .select()
    .from(orders)
    .where(eq(orders.customerEmail, email));
  expect(orderAfterRedirect?.status).toBe("NEW");
  expect(orderAfterRedirect?.customerPaymentStatus).toBe("PENDING");
  expect(orderAfterRedirect?.sellerSettlementStatus).toBe("NOT_APPLICABLE");

  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();
  // Scoped to the heading: Next.js's own route announcer (an
  // accessibility feature, #__next-route-announcer__) also echoes the
  // order number as plain text.
  await expect(page.getByRole("heading", { name: orderAfterRedirect!.orderNumber })).toBeVisible();

  const [finalOrder] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(finalOrder?.status).toBe("CONFIRMED");
  expect(finalOrder?.customerPaymentStatus).toBe("PAID");
  expect(finalOrder?.confirmedAt).not.toBeNull();

  const orderPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, finalOrder!.id));
  expect(orderPayments).toHaveLength(1);
  expect(orderPayments[0]).toMatchObject({
    method: "TWINT",
    provider: "SAFERPAY",
    status: "SUCCEEDED",
  });
});

test("a declined card payment can be retried with TWINT and then succeeds — one Order, two Payment attempts", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("card-retry");

  await startCheckoutWithMethod(page, email, "Carte bancaire");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate decline", exact: true }).click();

  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("refusé", { exact: false })).toBeVisible();

  const [afterDecline] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(afterDecline?.status).toBe("NEW");
  expect(afterDecline?.customerPaymentStatus).toBe("PENDING");

  await page.getByRole("button", { name: "Réessayer avec TWINT" }).click();
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();

  const [finalOrder] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(finalOrder?.status).toBe("CONFIRMED");
  expect(finalOrder?.customerPaymentStatus).toBe("PAID");

  // Exactly one Order was ever created for this checkout attempt.
  const matchingOrders = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(matchingOrders).toHaveLength(1);

  const orderPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, finalOrder!.id));
  expect(orderPayments).toHaveLength(2);
  const statuses = orderPayments.map((p) => p.status).sort();
  expect(statuses).toEqual(["FAILED", "SUCCEEDED"]);
});

test("a cancelled (aborted) payment shows the calm cancelled state and offers retry", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("cancelled");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate cancel", exact: true }).click();

  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("annulé", { exact: false }).first()).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("NEW");
  expect(order?.customerPaymentStatus).toBe("PENDING");

  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order!.id));
  expect(orderPayments).toHaveLength(1);
  expect(orderPayments[0]?.status).toBe("CANCELLED");
});

test("offline seller payment still works unchanged alongside online payment", async ({ page }) => {
  const email = testEmail("offline-unchanged");

  await startCheckoutWithMethod(page, email, "SELLER");
  await expect(page.getByText("Commande confirmée")).toBeVisible({ timeout: 15000 });

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("CONFIRMED");
  expect(order?.customerPaymentStatus).toBe("PENDING");
  expect(order?.sellerSettlementStatus).toBe("PENDING");

  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order!.id));
  expect(orderPayments).toHaveLength(1);
  expect(orderPayments[0]).toMatchObject({ method: "SELLER", provider: "OFFLINE" });
});

test("admin order detail shows the online payment attempt history, never a manual mark-paid action", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("admin-visibility");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));

  await createAndLogInAsTestAdmin(page, "online-payment-admin");
  await page.goto(`/admin/commandes/${order!.id}`, { waitUntil: "networkidle" });

  await expect(page.getByText("Tentatives de paiement en ligne")).toBeVisible();
  await expect(page.getByText("TWINT").first()).toBeVisible();
  await expect(page.getByText("Réussi")).toBeVisible();
  // Never a manual "mark online payment paid" action (docs/06 §20).
  await expect(
    page.getByRole("button", { name: "Marquer le paiement client comme reçu" }),
  ).not.toBeVisible();
});

// Phase 10 Gate 10C-B1: SuccessNotifyUrl/FailNotifyUrl coverage, driven
// entirely through the same double-gated fake provider — never real
// Saferpay. Fires the real `/api/payments/saferpay/notify/[token]`
// route directly (via `page.request.get`, a genuine out-of-band HTTP
// GET, not a browser navigation) to prove reconciliation works exactly
// like the real Saferpay server-to-server callback would.
async function readFakePageUrls(page: import("@playwright/test").Page) {
  const notifyText = await page.getByTestId("notify-url").textContent();
  const returnText = await page.getByTestId("return-url").textContent();
  return {
    notifyUrl: notifyText!.replace("Notify URL: ", "").trim(),
    returnUrl: returnText!.replace("Return URL: ", "").trim(),
  };
}

test("Notify-only: resolving success and firing the real notify route confirms the order WITHOUT ever visiting /commande/retour", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("notify-only-success");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  const { notifyUrl } = await readFakePageUrls(page);

  // The no-redirect action is a Server Action bound to a plain <form>
  // — it never triggers a browser navigation, so Playwright's own
  // click-triggered auto-waiting (which waits for navigation) cannot
  // be relied on here; wait for the actual POST response instead so
  // the mutation is guaranteed to have completed before the notify
  // call below fires.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Simulate success (no redirect)" }).click(),
  ]);
  // Still on the fake page — the no-redirect action never navigates.
  await expect(page).toHaveURL(/\/test\/fake-saferpay/);

  const response = await page.request.get(notifyUrl);
  expect(response.status()).toBe(200);

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("CONFIRMED");
  expect(order?.customerPaymentStatus).toBe("PAID");
});

test("Notify-only: a cancelled payment via the real notify route leaves the order NEW/PENDING", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("notify-only-cancel");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  const { notifyUrl } = await readFakePageUrls(page);

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Simulate cancel (no redirect)" }).click(),
  ]);
  await expect(page).toHaveURL(/\/test\/fake-saferpay/);

  const response = await page.request.get(notifyUrl);
  expect(response.status()).toBe(200);

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("NEW");
  expect(order?.customerPaymentStatus).toBe("PENDING");
});

test("Notify then Return: the return page shows the already-reconciled confirmed state", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("notify-then-return");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  const { notifyUrl, returnUrl } = await readFakePageUrls(page);

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Simulate success (no redirect)" }).click(),
  ]);
  const notifyResponse = await page.request.get(notifyUrl);
  expect(notifyResponse.status()).toBe(200);

  // Only NOW does the browser visit the return page — it must show the
  // already-reconciled state, never re-deriving or re-mutating it.
  await page.goto(returnUrl);
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();
});

test("Return then Notify: a subsequent duplicate notify callback is harmless", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("return-then-notify");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));

  const returnUrl = new URL(page.url());
  const token = returnUrl.searchParams.get("rt");
  const notifyUrl = `${returnUrl.origin}/api/payments/saferpay/notify/${token}`;
  const response = await page.request.get(notifyUrl);
  expect(response.status()).toBe(200);

  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order!.id));
  expect(events.filter((e) => e.type === "PAYMENT_CONFIRMED_BY_PROVIDER")).toHaveLength(1);

  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order!.id));
  const pEvents = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.paymentId, orderPayments[0]!.id));
  expect(pEvents).toHaveLength(1);
});
