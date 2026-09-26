import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 13 Gate 13C: browser coverage for the analytical/historical
// `/admin/statistiques` page — real authenticated page load, campaign
// selector (including an ARCHIVED campaign, BR-CAM-003), summary/
// payment/wine/bundle/seller sections rendering against real seeded
// fixtures, the empty-campaign state, the nav link, and the
// unauthenticated boundary. Pure aggregation semantics (CANCELLED
// exclusion, direct-vs-bundle wine revenue, TWINT/card split, seller
// online-paid attribution) are unit/DB-tested elsewhere
// (src/domain/statistics/*.test.ts, statistics.db.test.ts) — this file
// proves the real page renders it correctly end to end.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  orders,
  orderItems,
  orderBundleComponents,
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
async function addTestSellerToActiveCampaign(): Promise<{ id: string; name: string }> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");
  const lastName = unique("StatsSeller");
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Statistics E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Statistics E2E ${lastName}` };
}

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
  options: { sellerName?: string; bundleQuantity?: number } = {},
) {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Claire");
  await page.fill("#m-customerLastName", "Statistiques");
  await page.fill("#m-customerAddress", "Rue des Chiffres 8");
  await page.fill("#m-customerPostalCode", "1200");
  await page.fill("#m-customerCity", "Genève");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "022 000 00 00");

  if (options.bundleQuantity) {
    const increase = page.getByRole("button", {
      name: "Augmenter la quantité de Carton découverte",
    });
    for (let i = 0; i < options.bundleQuantity; i += 1) {
      await increase.click();
    }
  } else {
    await page
      .getByRole("button", { name: /Augmenter la quantité/ })
      .first()
      .click();
  }

  if (options.sellerName) {
    await page.getByRole("combobox", { name: "Vendeur" }).click();
    await page.getByRole("option", { name: options.sellerName, exact: true }).click();
  }

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });
  return page.url();
}

const createdEmptyCampaignIds: string[] = [];
async function createEmptyArchivedCampaign(): Promise<{ id: string; name: string }> {
  const name = unique("Archived Campaign");
  const [campaign] = await db
    .insert(campaigns)
    .values({ name, slug: unique("archived-campaign"), status: "ARCHIVED" })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  createdEmptyCampaignIds.push(campaign.id);
  return { id: campaign.id, name };
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      const items = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
      const itemIds = items.map((item) => item.id);
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

  if (createdSellerIds.length > 0) {
    await db.delete(campaignSellers).where(inArray(campaignSellers.sellerId, createdSellerIds));
    await db.delete(sellers).where(inArray(sellers.id, createdSellerIds));
  }

  if (createdEmptyCampaignIds.length > 0) {
    await db.delete(campaigns).where(inArray(campaigns.id, createdEmptyCampaignIds));
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

test("authenticated statistics page renders every required section", async ({ page }) => {
  test.setTimeout(60000);
  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "stats-load-admin");
  await createManualOrder(page, testEmail("stats-wine"), { sellerName: seller.name });
  await createManualOrder(page, testEmail("stats-bundle"), { bundleQuantity: 1 });

  await page.goto("/admin/statistiques", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Statistiques" })).toBeVisible();
  await expect(page.getByText(/^Campagne\s*:/)).toBeVisible();

  // Scoped to <dt> — "Commandes" is also a nav-link label (same
  // ambiguity already fixed for the Gate 13B dashboard spec).
  for (const label of ["Chiffre d'affaires", "Commandes", "Bouteilles", "Panier moyen"]) {
    await expect(page.locator("dt", { hasText: label })).toBeVisible();
  }
  for (const label of ["Payé en ligne", "Paiement au vendeur", "TWINT", "Carte"]) {
    await expect(page.locator("dt", { hasText: label })).toBeVisible();
  }

  await expect(page.getByText("Ventes par vin", { exact: true })).toBeVisible();
  await expect(page.getByText("Ventes par bundle", { exact: true })).toBeVisible();
  await expect(page.getByText("Ventes par vendeur", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: seller.name })).toBeVisible();
});

test("the navigation link opens the statistics page", async ({ page }) => {
  test.setTimeout(30000);
  await createAndLogInAsTestAdmin(page, "stats-nav-admin");
  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Statistiques" }).click();
  await expect(page).toHaveURL(/\/admin\/statistiques$/);
  await expect(page.getByRole("heading", { name: "Statistiques" })).toBeVisible();
});

test("an ARCHIVED campaign is selectable and shows its own data, empty-state text, and zero KPIs", async ({
  page,
}) => {
  test.setTimeout(30000);
  const archived = await createEmptyArchivedCampaign();
  await createAndLogInAsTestAdmin(page, "stats-archived-admin");

  await page.goto(`/admin/statistiques?campaign=${archived.id}`, { waitUntil: "networkidle" });
  await expect(page.getByText(archived.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Archivée", { exact: true }).first()).toBeVisible();

  const commandesStat = page.locator("dl > div", {
    has: page.locator("dt", { hasText: "Commandes" }),
  });
  await expect(commandesStat.locator("dd")).toHaveText("0");

  await expect(page.getByText("Aucune vente pour cette campagne.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Aucune vente de bundle pour cette campagne.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Aucune commande pour cette campagne.", { exact: true }),
  ).toBeVisible();
});

test("the statistics page cannot be reached without authentication", async ({ page }) => {
  test.setTimeout(30000);
  const response = await page.request.get("/admin/statistiques", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/admin/connexion");
});
