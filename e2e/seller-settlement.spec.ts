import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 8: browser coverage for the offline money flow — mark customer
// payment received, then settle a seller's collected orders. Manual
// order creation is used as the order-creation vehicle throughout
// (rather than public checkout) since this suite's focus is the
// financial workflow, not checkout itself, and Phase 7 already proves
// manual/online orders share the identical creation core — DB tests
// separately prove settlement doesn't branch on `source` either.
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
  sellerSettlements,
  sellerSettlementOrders,
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
  const lastName = unique("SettleSeller");
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Settlement E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Settlement E2E ${lastName}` };
}

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
  sellerName?: string,
) {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Marie");
  await page.fill("#m-customerLastName", "Payeuse");
  await page.fill("#m-customerAddress", "Rue du Marché 3");
  await page.fill("#m-customerPostalCode", "1400");
  await page.fill("#m-customerCity", "Yverdon-les-Bains");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "024 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();

  if (sellerName) {
    await page.getByRole("combobox", { name: "Vendeur" }).click();
    await page.getByRole("option", { name: sellerName, exact: true }).click();
  }

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });
}

test.afterAll(async () => {
  if (createdSellerIds.length > 0) {
    const settlementRows = await db
      .select({ id: sellerSettlements.id })
      .from(sellerSettlements)
      .where(inArray(sellerSettlements.sellerId, createdSellerIds));
    const settlementIds = settlementRows.map((row) => row.id);
    if (settlementIds.length > 0) {
      await db
        .delete(sellerSettlementOrders)
        .where(inArray(sellerSettlementOrders.sellerSettlementId, settlementIds));
      await db.delete(sellerSettlements).where(inArray(sellerSettlements.id, settlementIds));
    }
  }

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

test("realistic end-to-end flow: mark payment received, create a settlement, verify figures and history", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = testEmail("settlement-flow");
  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "settlement-admin");

  await createManualOrder(page, email, seller.name);
  const orderUrl = page.url();

  // Mark customer payment received.
  await page.getByRole("button", { name: "Marquer le paiement client comme reçu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Payée")).toBeVisible();
  await expect(page.getByText("CUSTOMER_PAYMENT_MARKED_PAID")).toBeVisible();
  // Settlement remains PENDING — money hasn't reached Mélodia yet.
  await expect(page.locator("dd").filter({ hasText: "En attente" })).toBeVisible();

  // Seller detail: verify pre-settlement financial figures.
  await page.goto(`/admin/vendeurs/${seller.id}`, { waitUntil: "networkidle" });
  await expect(page.getByText("CHF 18.–", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("À remettre à Mélodia")).toBeVisible();

  // Create the settlement.
  const checkbox = page.getByRole("checkbox").first();
  await checkbox.click();
  await page.getByRole("button", { name: "Enregistrer le règlement" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer le règlement" }).click();

  await expect(page.getByText("Aucune commande encaissée en attente de règlement")).toBeVisible();
  await expect(page.getByText("commande(s)")).toBeVisible();

  // Order detail now shows the order as settled.
  await page.goto(orderUrl, { waitUntil: "networkidle" });
  await expect(page.getByText("Réglé", { exact: true })).toBeVisible();
  await expect(page.getByText("SETTLEMENT_COMPLETED")).toBeVisible();
});

test("seller detail shows a calm empty state when there is nothing to settle", async ({ page }) => {
  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "settlement-empty-admin");

  await page.goto(`/admin/vendeurs/${seller.id}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Aucune commande encaissée en attente de règlement")).toBeVisible();
  await expect(page.getByText("Aucun règlement enregistré")).toBeVisible();
});

test("a paid order cannot be cancelled", async ({ page }) => {
  const email = testEmail("blocked-cancel");
  await createAndLogInAsTestAdmin(page, "blocked-cancel-admin");

  await createManualOrder(page, email);
  await page.getByRole("button", { name: "Marquer le paiement client comme reçu" }).click();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Payée")).toBeVisible();

  await expect(page.getByRole("button", { name: "Annuler la commande" })).not.toBeVisible();
});

test("a settled order's seller cannot be reassigned", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("blocked-reassign");
  const sellerA = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "blocked-reassign-admin");

  await createManualOrder(page, email, sellerA.name);
  await page.getByRole("button", { name: "Marquer le paiement client comme reçu" }).click();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Payée")).toBeVisible();

  await page.goto(`/admin/vendeurs/${sellerA.id}`, { waitUntil: "networkidle" });
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Enregistrer le règlement" }).click();
  await page.getByRole("button", { name: "Confirmer le règlement" }).click();
  await expect(page.getByText("Aucune commande encaissée en attente de règlement")).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  await page.goto(`/admin/commandes/${order!.id}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Vendeur" })).not.toBeVisible();
  // Avoids the rendered curly apostrophe ("l’argent") in the copy.
  await expect(page.getByText("ne peut plus être modifié")).toBeVisible();
});

test("marking payment received twice behaves cleanly — no duplicate, no crash", async ({
  page,
}) => {
  const email = testEmail("repeat-markpaid");
  await createAndLogInAsTestAdmin(page, "repeat-markpaid-admin");

  await createManualOrder(page, email);
  await page.getByRole("button", { name: "Marquer le paiement client comme reçu" }).click();
  await page.getByRole("button", { name: "Confirmer l'encaissement" }).click();
  await expect(page.getByText("Payée")).toBeVisible();

  // The action is no longer offered once already paid.
  await expect(
    page.getByRole("button", { name: "Marquer le paiement client comme reçu" }),
  ).not.toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  const paidEvents = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order!.id));
  expect(paidEvents.filter((e) => e.type === "CUSTOMER_PAYMENT_MARKED_PAID")).toHaveLength(1);
});
