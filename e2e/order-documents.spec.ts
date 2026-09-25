import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 12 Gate 12C: browser coverage for the two authenticated
// customer-facing commercial documents (order confirmation, receipt).
// Mirrors e2e/preparation-documents.spec.ts's exact fixture/auth-proof
// patterns. Deep content correctness (organisation identity, item
// totals, bundle composition, payment-method wording, the RECEIPT-
// only-when-PAID guarantee) is unit/renderer-tested elsewhere
// (src/domain/documents/build-order-document-content.test.ts,
// src/infrastructure/documents/pdf-renderer.test.ts) — this file
// proves the real authenticated download path and eligibility-driven
// UI end to end.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  orders,
  orderItems,
  payments,
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

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
): Promise<string> {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Amélie");
  await page.fill("#m-customerLastName", "Documents");
  await page.fill("#m-customerAddress", "Chemin des Vignes 9");
  await page.fill("#m-customerPostalCode", "1204");
  await page.fill("#m-customerCity", "Genève");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "022 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });
  return page.url();
}

async function markOrderPaid(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Marquer le paiement client comme reçu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Payée", { exact: true })).toBeVisible();
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(payments).where(inArray(payments.orderId, orderIds));
      await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
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

test("PENDING order: confirmation downloadable, receipt hidden with explanation, receipt route rejects safely", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-pending");
  await createAndLogInAsTestAdmin(page, "doc-pending-admin");

  const orderUrl = await createManualOrder(page, email);

  await expect(page.getByRole("link", { name: "Confirmation de commande (PDF)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reçu (PDF)" })).not.toBeVisible();
  await expect(
    page.getByText("Le reçu sera disponible une fois le paiement reçu.", { exact: false }),
  ).toBeVisible();

  const confirmationResponse = await page.request.get(`${orderUrl}/documents/confirmation.pdf`);
  expect(confirmationResponse.status()).toBe(200);
  expect(confirmationResponse.headers()["content-type"]).toBe("application/pdf");
  expect(confirmationResponse.headers()["content-disposition"]).toContain("attachment");
  expect(confirmationResponse.headers()["content-disposition"]).toMatch(
    /confirmation-ECM-\d{4}-\d+\.pdf/,
  );
  expect(confirmationResponse.headers()["cache-control"]).toContain("no-store");
  const confirmationBody = await confirmationResponse.body();
  expect(confirmationBody.subarray(0, 4).toString("utf-8")).toBe("%PDF");

  const receiptResponse = await page.request.get(`${orderUrl}/documents/receipt.pdf`);
  expect(receiptResponse.status()).toBe(409);
  const receiptBody = await receiptResponse.text();
  expect(receiptBody).not.toContain("%PDF");
});

test("PAID order: both confirmation and receipt are downloadable and correctly labelled", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-paid");
  await createAndLogInAsTestAdmin(page, "doc-paid-admin");

  const orderUrl = await createManualOrder(page, email);
  await markOrderPaid(page);

  await expect(page.getByRole("link", { name: "Confirmation de commande (PDF)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reçu (PDF)" })).toBeVisible();

  const receiptResponse = await page.request.get(`${orderUrl}/documents/receipt.pdf`);
  expect(receiptResponse.status()).toBe(200);
  expect(receiptResponse.headers()["content-type"]).toBe("application/pdf");
  expect(receiptResponse.headers()["content-disposition"]).toMatch(/recu-ECM-\d{4}-\d+\.pdf/);
  expect(receiptResponse.headers()["cache-control"]).toContain("no-store");
  const receiptBody = await receiptResponse.body();
  expect(receiptBody.subarray(0, 4).toString("utf-8")).toBe("%PDF");

  const confirmationResponse = await page.request.get(`${orderUrl}/documents/confirmation.pdf`);
  expect(confirmationResponse.status()).toBe(200);
});

test("CANCELLED order: neither commercial-document action shown, both routes reject safely", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-cancelled-commercial");
  await createAndLogInAsTestAdmin(page, "doc-cancelled-commercial-admin");

  const orderUrl = await createManualOrder(page, email);
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Confirmation de commande (PDF)" }),
  ).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Reçu (PDF)" })).not.toBeVisible();
  await expect(
    page.getByText("Commande annulée — aucun document commercial ne peut être généré.", {
      exact: false,
    }),
  ).toBeVisible();

  const confirmationResponse = await page.request.get(`${orderUrl}/documents/confirmation.pdf`);
  expect(confirmationResponse.status()).toBe(409);
  expect(await confirmationResponse.text()).not.toContain("%PDF");

  const receiptResponse = await page.request.get(`${orderUrl}/documents/receipt.pdf`);
  expect(receiptResponse.status()).toBe(409);
  expect(await receiptResponse.text()).not.toContain("%PDF");
});

test("neither commercial-document route can be retrieved without valid authentication", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-commercial-auth");
  await createAndLogInAsTestAdmin(page, "doc-commercial-auth-admin");
  const orderUrl = await createManualOrder(page, email);

  const confirmationUrl = `${new URL(orderUrl).pathname}/documents/confirmation.pdf`;
  const receiptUrl = `${new URL(orderUrl).pathname}/documents/receipt.pdf`;

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const anonConfirmation = await anonymousPage.request.get(confirmationUrl, { maxRedirects: 0 });
  expect(anonConfirmation.status()).toBe(307);
  expect(anonConfirmation.headers()["location"]).toContain("/admin/connexion");
  const anonReceipt = await anonymousPage.request.get(receiptUrl, { maxRedirects: 0 });
  expect(anonReceipt.status()).toBe(307);
  await anonymousContext.close();

  const forgedContext = await browser.newContext();
  await forgedContext.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged-token-value.not-a-real-signature",
      url: "http://localhost:3000",
    },
  ]);
  const forgedPage = await forgedContext.newPage();
  const forgedConfirmation = await forgedPage.request.get(confirmationUrl, { maxRedirects: 0 });
  expect(forgedConfirmation.status()).toBe(401);
  const forgedReceipt = await forgedPage.request.get(receiptUrl, { maxRedirects: 0 });
  expect(forgedReceipt.status()).toBe(401);
  await forgedContext.close();
});

test("an invalid order id fails safely for both commercial-document routes", async ({ page }) => {
  test.setTimeout(60000);
  await createAndLogInAsTestAdmin(page, "doc-commercial-invalid-admin");

  const invalidConfirmation = await page.request.get(
    `/admin/commandes/${randomUUID()}/documents/confirmation.pdf`,
  );
  expect(invalidConfirmation.status()).toBe(404);
  expect(await invalidConfirmation.text()).not.toContain("%PDF");

  const invalidReceipt = await page.request.get(
    `/admin/commandes/${randomUUID()}/documents/receipt.pdf`,
  );
  expect(invalidReceipt.status()).toBe(404);
  expect(await invalidReceipt.text()).not.toContain("%PDF");
});

test("no internal UUID appears in either document's filename", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("doc-uuid");
  await createAndLogInAsTestAdmin(page, "doc-uuid-admin");
  const orderUrl = await createManualOrder(page, email);
  const orderId = orderUrl.split("/admin/commandes/")[1]!.split(/[?#]/)[0]!;

  const confirmationResponse = await page.request.get(`${orderUrl}/documents/confirmation.pdf`);
  const disposition = confirmationResponse.headers()["content-disposition"] ?? "";
  expect(disposition).not.toContain(orderId);
});
