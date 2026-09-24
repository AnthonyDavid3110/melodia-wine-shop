import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 12 Gate 12B: browser coverage for the authenticated preparation
// PDF downloads (individual order + seller). Mirrors
// e2e/exports.spec.ts's own auth-boundary proof (Proxy redirect vs the
// Route Handler's own getAdminOrNull() 401) and
// e2e/preparation-fulfilment.spec.ts's manual-order-creation fixture
// pattern. Deep content/pagination correctness is unit/renderer-tested
// elsewhere (src/domain/documents/*.test.ts,
// src/infrastructure/documents/pdf-renderer.test.ts) — this file
// proves the real authenticated download path end to end.
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
  sellers,
  campaignSellers,
  campaigns,
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

const createdSellerIds: string[] = [];
async function addTestSellerToActiveCampaign(label: string): Promise<{ id: string; name: string }> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");
  const lastName = unique(label);
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Doc E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Doc E2E ${lastName}` };
}

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
  options: { sellerName?: string } = {},
): Promise<string> {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Marie");
  await page.fill("#m-customerLastName", "Documents");
  await page.fill("#m-customerAddress", "Chemin du Vignoble 4");
  await page.fill("#m-customerPostalCode", "1110");
  await page.fill("#m-customerCity", "Morges");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "021 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();

  if (options.sellerName) {
    await page.getByRole("combobox", { name: "Vendeur" }).click();
    await page.getByRole("option", { name: options.sellerName, exact: true }).click();
  }

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });
  return page.url();
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

  if (createdSellerIds.length > 0) {
    await db.delete(campaignSellers).where(inArray(campaignSellers.sellerId, createdSellerIds));
    await db.delete(sellers).where(inArray(sellers.id, createdSellerIds));
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

test("individual preparation PDF: UI action present, authenticated download is a valid PDF", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-individual");
  await createAndLogInAsTestAdmin(page, "doc-individual-admin");

  const orderUrl = await createManualOrder(page, email);
  await expect(page.getByRole("link", { name: "Bon de préparation (PDF)" })).toBeVisible();

  const response = await page.request.get(`${orderUrl}/documents/preparation.pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["content-disposition"]).toMatch(/preparation-ECM-\d{4}-\d+\.pdf/);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.body();
  expect(body.subarray(0, 4).toString("utf-8")).toBe("%PDF");
});

test("CANCELLED order: no download action shown, route rejects safely", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("doc-cancelled");
  await createAndLogInAsTestAdmin(page, "doc-cancelled-admin");

  const orderUrl = await createManualOrder(page, email);
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "Bon de préparation (PDF)" })).not.toBeVisible();
  await expect(
    page.getByText("aucun bon de préparation ne peut être généré", {
      exact: false,
    }),
  ).toBeVisible();

  const response = await page.request.get(`${orderUrl}/documents/preparation.pdf`);
  expect(response.status()).toBe(409);
  const body = await response.text();
  expect(body).not.toContain("%PDF");
});

test("seller preparation PDF: UI action present, authenticated multi-order download is a valid PDF", async ({
  page,
}) => {
  test.setTimeout(90000);
  const seller = await addTestSellerToActiveCampaign("DocSeller");
  await createAndLogInAsTestAdmin(page, "doc-seller-admin");

  await createManualOrder(page, testEmail("doc-seller-1"), { sellerName: seller.name });
  await createManualOrder(page, testEmail("doc-seller-2"), { sellerName: seller.name });

  await page.goto("/admin/preparation", { waitUntil: "networkidle" });
  // Scoped by href to this specific seller — /admin/preparation lists
  // every seller with eligible orders in the shared e2e campaign, so a
  // page-wide "first PDF link" would be flaky across parallel/serial
  // spec runs.
  const sellerPdfLink = page.locator(`a[href*="/admin/preparation/documents/seller/${seller.id}"]`);
  await expect(sellerPdfLink).toBeVisible();
  const href = await sellerPdfLink.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.body();
  expect(body.subarray(0, 4).toString("utf-8")).toBe("%PDF");
  // Two real orders' worth of content is comfortably non-trivial.
  expect(body.length).toBeGreaterThan(1500);
});

test("neither PDF route can be retrieved without valid authentication", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const email = testEmail("doc-auth");
  await createAndLogInAsTestAdmin(page, "doc-auth-admin");
  const orderUrl = await createManualOrder(page, email);
  const orderId = orderUrl.split("/admin/commandes/")[1]!.split(/[?#]/)[0]!;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  const seller = await addTestSellerToActiveCampaign("DocAuthSeller");

  const individualUrl = `/admin/commandes/${orderId}/documents/preparation.pdf`;
  const sellerUrl = `/admin/preparation/documents/seller/${seller.id}?campaign=${order!.campaignId}`;

  // Cookie-less: caught by the Proxy's redirect before the Route Handler runs.
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const anonIndividual = await anonymousPage.request.get(individualUrl, { maxRedirects: 0 });
  expect(anonIndividual.status()).toBe(307);
  expect(anonIndividual.headers()["location"]).toContain("/admin/connexion");
  const anonSeller = await anonymousPage.request.get(sellerUrl, { maxRedirects: 0 });
  expect(anonSeller.status()).toBe(307);
  await anonymousContext.close();

  // Forged-but-present cookie: passes the Proxy's presence-only check,
  // rejected by the Route Handler's own getAdminOrNull().
  const forgedContext = await browser.newContext();
  await forgedContext.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged-token-value.not-a-real-signature",
      url: "http://localhost:3000",
    },
  ]);
  const forgedPage = await forgedContext.newPage();
  const forgedIndividual = await forgedPage.request.get(individualUrl, { maxRedirects: 0 });
  expect(forgedIndividual.status()).toBe(401);
  const forgedSeller = await forgedPage.request.get(sellerUrl, { maxRedirects: 0 });
  expect(forgedSeller.status()).toBe(401);
  await forgedContext.close();
});

test("invalid order id, invalid seller id, and a seller with no eligible orders all fail safely", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsTestAdmin(page, "doc-invalid-admin");

  const invalidOrderResponse = await page.request.get(
    `/admin/commandes/${randomUUID()}/documents/preparation.pdf`,
  );
  expect(invalidOrderResponse.status()).toBe(404);
  expect(await invalidOrderResponse.text()).not.toContain("%PDF");

  const invalidSellerResponse = await page.request.get(
    `/admin/preparation/documents/seller/${randomUUID()}`,
  );
  expect(invalidSellerResponse.status()).toBe(404);
  expect(await invalidSellerResponse.text()).not.toContain("%PDF");

  const sellerWithNoOrders = await addTestSellerToActiveCampaign("DocEmptySeller");
  const emptySellerResponse = await page.request.get(
    `/admin/preparation/documents/seller/${sellerWithNoOrders.id}`,
  );
  expect(emptySellerResponse.status()).toBe(404);
  const emptyBody = await emptySellerResponse.text();
  expect(emptyBody).not.toContain("%PDF");
  expect(emptyBody).not.toContain(sellerWithNoOrders.id);
});
