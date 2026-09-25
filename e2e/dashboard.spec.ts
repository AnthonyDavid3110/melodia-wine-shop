import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 13 Gate 13B: browser coverage for the operational `/admin`
// dashboard — real page load, KPI/alert/recent-orders rendering against
// the shared seeded campaign, and the alert deep-links into the
// (Gate 13B-extended) `/admin/commandes` filters. Pure aggregation
// math (revenue/orders/bottles/payment split/alert eligibility/seller-
// objective counting) is unit-tested in `src/domain/dashboard/*.test.ts`
// — this file proves the real authenticated page renders it correctly
// and the alert links actually work end to end.
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
const createdSellerIds: string[] = [];

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

async function addTestSellerToActiveCampaign(): Promise<{ id: string; name: string }> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");
  const lastName = unique("DashboardSeller");
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Dashboard E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Dashboard E2E ${lastName}` };
}

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
  options: { sellerName?: string } = {},
) {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Sophie");
  await page.fill("#m-customerLastName", "Dashboard");
  await page.fill("#m-customerAddress", "Avenue du Lac 2");
  await page.fill("#m-customerPostalCode", "1800");
  await page.fill("#m-customerCity", "Vevey");
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

async function orderNumberFor(email: string): Promise<string> {
  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  if (!order) throw new Error(`no order found for ${email}`);
  return order.orderNumber;
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

test("authenticated dashboard renders campaign context, every KPI group, and seller-objective visibility", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsTestAdmin(page, "dashboard-load-admin");

  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(page.getByText(/^Campagne\s*:/)).toBeVisible();

  // StatGrid renders each KPI label as a plain <dt>, which disambiguates
  // from same-named nav links (e.g. "Commandes" is both a nav link and a
  // KPI label) without relying on ARIA role computation.
  for (const label of [
    "Chiffre d'affaires",
    "Commandes",
    "Bouteilles",
    "Panier moyen",
    "Payé en ligne",
    "Paiement au vendeur",
    "Encaissements clients en attente",
    "Règlements vendeurs en attente",
    "Non attribuées",
    "À préparer",
    "Préparées",
    "Livrées",
  ]) {
    await expect(page.locator("dt", { hasText: label })).toBeVisible();
  }

  await expect(page.getByText("Objectifs vendeurs", { exact: true })).toBeVisible();
  await expect(page.getByText("Commandes récentes", { exact: true })).toBeVisible();
});

test("unassigned order triggers the alert, which deep-links into a correctly filtered order list", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("dash-unassigned");
  await createAndLogInAsTestAdmin(page, "dashboard-unassigned-admin");
  await createManualOrder(page, email);
  const orderNumber = await orderNumberFor(email);

  await page.goto("/admin", { waitUntil: "networkidle" });
  const alert = page.getByRole("link", { name: /non attribuée/ });
  await expect(alert).toBeVisible();
  await alert.click();

  await expect(page).toHaveURL(/\/admin\/commandes\?seller=unassigned/);
  await expect(page.getByRole("link", { name: orderNumber })).toBeVisible();
});

test("a delivered-but-unpaid order triggers the alert, which deep-links into a correctly filtered order list", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = testEmail("dash-delivered-unpaid");
  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "dashboard-delivered-admin");
  const orderUrl = await createManualOrder(page, email, { sellerName: seller.name });
  const orderNumber = await orderNumberFor(email);

  await page.goto(orderUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Marquer comme préparée" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme préparée" })).not.toBeVisible();
  await page.getByRole("button", { name: "Remettre au vendeur" }).click();
  await expect(page.getByRole("button", { name: "Remettre au vendeur" })).not.toBeVisible();
  await page.getByRole("button", { name: "Marquer comme livrée" }).click();
  await expect(page.getByText("Livrée", { exact: true })).toBeVisible();

  await page.goto("/admin", { waitUntil: "networkidle" });
  const alert = page.getByRole("link", { name: /livrée.*non payée/ });
  await expect(alert).toBeVisible();
  await alert.click();

  await expect(page).toHaveURL(/\/admin\/commandes\?status=DELIVERED&paymentStatus=PENDING/);
  await expect(page.getByRole("link", { name: orderNumber })).toBeVisible();
});

test("a recent-order link opens the order's own detail page", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("dash-recent");
  await createAndLogInAsTestAdmin(page, "dashboard-recent-admin");
  await createManualOrder(page, email);
  const orderNumber = await orderNumberFor(email);

  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/[^/?]+$/);
  await expect(page.getByText(orderNumber, { exact: false }).first()).toBeVisible();
});

test("the dashboard cannot be reached without authentication", async ({ page }) => {
  test.setTimeout(30000);
  const response = await page.request.get("/admin", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/admin/connexion");
});
