import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 7: browser coverage for admin order management — manual order
// creation (through the SAME order-creation core as public checkout),
// seller reassignment, and cancellation. Against the shared seeded
// campaign/products/sellers, real committed rows, cleaned up in
// `afterAll` regardless of pass/fail.
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

/** A seller attached to the real seeded ACTIVE campaign, for reassignment tests. */
async function addTestSellerToActiveCampaign(): Promise<{ id: string; name: string }> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");
  const lastName = unique("TestSeller");
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Admin E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Admin E2E ${lastName}` };
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

test("an admin can create a manual order using the same authoritative pricing core", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("manual-order");
  await createAndLogInAsTestAdmin(page, "manual-order-admin");

  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Marie");
  await page.fill("#m-customerLastName", "Papier");
  await page.fill("#m-customerAddress", "Chemin du Bois 4");
  await page.fill("#m-customerPostalCode", "1200");
  await page.fill("#m-customerCity", "Genève");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "022 000 00 00");

  // Increase the first product's quantity to 2 via its QuantitySelector "+" button.
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });
  await expect(page.getByText("Manuelle")).toBeVisible();
  await expect(page.locator('input[name="customerEmail"]')).toHaveValue(email);
});

test("an admin can reassign an order's seller and then unassign it", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("reassign-order");
  const sellerA = await addTestSellerToActiveCampaign();
  const sellerB = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "reassign-admin");

  // Create a quick manual order to reassign.
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Paul");
  await page.fill("#m-customerLastName", "Client");
  await page.fill("#m-customerAddress", "Rue Neuve 8");
  await page.fill("#m-customerPostalCode", "1800");
  await page.fill("#m-customerCity", "Vevey");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "021 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });

  // Assign seller A.
  await page.getByRole("combobox", { name: "Vendeur" }).click();
  await page.getByRole("option", { name: sellerA.name }).click();
  await page.getByRole("button", { name: "Mettre à jour le vendeur" }).click();
  await expect(page.getByText(`Actuel : ${sellerA.name}`)).toBeVisible();

  // Reassign to seller B.
  await page.getByRole("combobox", { name: "Vendeur" }).click();
  await page.getByRole("option", { name: sellerB.name }).click();
  await page.getByRole("button", { name: "Mettre à jour le vendeur" }).click();
  await expect(page.getByText(`Actuel : ${sellerB.name}`)).toBeVisible();

  // Unassign.
  await page.getByRole("combobox", { name: "Vendeur" }).click();
  await page.getByRole("option", { name: "Non assigné" }).click();
  await page.getByRole("button", { name: "Mettre à jour le vendeur" }).click();
  await expect(page.getByText("Actuel : Non assigné")).toBeVisible();
});

test("an admin can cancel an order after explicit confirmation", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("cancel-order");
  await createAndLogInAsTestAdmin(page, "cancel-admin");

  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Alice");
  await page.fill("#m-customerLastName", "Annule");
  await page.fill("#m-customerAddress", "Route du Lac 2");
  await page.fill("#m-customerPostalCode", "1600");
  await page.fill("#m-customerCity", "Bulle");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "026 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });

  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler la commande" }).click();

  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
});
