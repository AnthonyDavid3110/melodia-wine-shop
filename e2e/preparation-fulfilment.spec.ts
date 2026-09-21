import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 9: browser coverage for the physical preparation/fulfilment
// workflow — wine requirements, seller grouping, unassigned orders,
// individual and bulk transitions, and CLOSED-campaign accessibility.
// Manual order creation is the vehicle throughout (same rationale as
// e2e/seller-settlement.spec.ts). Orders are created against the real
// seeded ACTIVE campaign ("Les Vins de Mélodia 2026") rather than a
// fresh one, since only one campaign may be ACTIVE at a time
// (`campaigns_one_active_idx`) and this suite must not disturb that
// invariant for other e2e spec files running in the same serial
// (workers: 1) suite.
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
  const lastName = unique("FulfilSeller");
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Fulfilment E2E", lastName, active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  createdSellerIds.push(seller.id);
  await db
    .insert(campaignSellers)
    .values({ campaignId: campaign.id, sellerId: seller.id, active: true });
  return { id: seller.id, name: `Fulfilment E2E ${lastName}` };
}

async function createManualOrder(
  page: import("@playwright/test").Page,
  email: string,
  options: { sellerName?: string; bundleQuantity?: number } = {},
) {
  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Marie");
  await page.fill("#m-customerLastName", "Preparation");
  await page.fill("#m-customerAddress", "Chemin du Vignoble 4");
  await page.fill("#m-customerPostalCode", "1110");
  await page.fill("#m-customerCity", "Morges");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "021 000 00 00");

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

test("realistic end-to-end flow: requirements, seller grouping, prepare, handoff, deliver", async ({
  page,
}) => {
  test.setTimeout(120000);

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");

  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "prep-flow-admin");

  const directOrderUrl = await createManualOrder(page, testEmail("direct"), {
    sellerName: seller.name,
  });
  const bundleOrderUrl = await createManualOrder(page, testEmail("bundle"), {
    sellerName: seller.name,
    bundleQuantity: 2,
  });
  const unassignedOrderUrl = await createManualOrder(page, testEmail("unassigned"));

  // --- Preparation dashboard: campaign context, requirements, carton math, unassigned bucket ---
  // The exact Chasselas total is asserted against the authoritative
  // DB-computed value at this instant (`getCampaignWineRequirements`),
  // never against an arithmetic guess based on a pre-test snapshot —
  // the shared seeded campaign may already carry Chasselas-referencing
  // orders from other admin/checkout flows, so only "the UI shows
  // exactly what the domain calculation says right now" is a robust
  // assertion here.
  const { getCampaignWineRequirements } =
    await import("../src/infrastructure/fulfilment/fulfilment");
  const requirementsAfter = await getCampaignWineRequirements(campaign.id);
  const chasselasRequirement = requirementsAfter.find((r) => r.productName === "Chasselas");
  expect(chasselasRequirement).toBeDefined();

  await page.goto(`/admin/preparation?campaign=${campaign.id}`, { waitUntil: "networkidle" });
  await expect(page.getByText(campaign.name, { exact: true }).first()).toBeVisible();

  const chasselasRow = page.locator("tr", { hasText: "Chasselas" });
  await expect(chasselasRow).toContainText(String(chasselasRequirement!.bottles));

  // "Non attribuées" appears both in the summary counts and as the
  // unassigned group's own heading — scope to the group heading.
  await expect(page.locator("#par-vendeur").getByText("Non attribuées")).toBeVisible();
  await expect(page.getByText(seller.name, { exact: false }).first()).toBeVisible();

  // --- Individual prepare on the unassigned order ---
  await page.goto(unassignedOrderUrl, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Marquer comme préparée" })).toBeVisible();
  // Invalid/skipped actions must not be offered on a CONFIRMED order.
  await expect(page.getByRole("button", { name: "Remettre au vendeur" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme livrée" })).not.toBeVisible();
  await page.getByRole("button", { name: "Marquer comme préparée" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme préparée" })).not.toBeVisible();
  // Avoids the rendered curly apostrophe ("d’abord") in the copy.
  await expect(page.getByText("avant de pouvoir la remettre", { exact: false })).toBeVisible();

  // --- Bulk-prepare the two seller-assigned orders from "Toutes les commandes" ---
  await page.goto(`/admin/preparation?campaign=${campaign.id}`, { waitUntil: "networkidle" });
  await page.locator("#toutes-les-commandes").scrollIntoViewIfNeeded();
  await page.getByLabel("Tout sélectionner").first().click();
  await page.getByRole("button", { name: "Marquer comme préparées" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // --- Bulk handoff for the seller (both their orders are now PREPARED) ---
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#par-vendeur").scrollIntoViewIfNeeded();
  await page.getByLabel("Tout sélectionner").first().click();
  await page.getByRole("button", { name: "Remettre au vendeur" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // --- Bulk delivery for the seller ---
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#par-vendeur").scrollIntoViewIfNeeded();
  await page.getByLabel("Tout sélectionner").first().click();
  await page.getByRole("button", { name: "Marquer comme livrées" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // --- Order detail: timestamps, history, next-action visibility, seller-reassignment warning ---
  await page.goto(directOrderUrl, { waitUntil: "networkidle" });
  await expect(page.getByText("Livrée", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Commande préparée")).toBeVisible();
  await expect(page.getByText("Commande remise au vendeur")).toBeVisible();
  await expect(page.getByText("Commande livrée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme préparée" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Remettre au vendeur" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme livrée" })).not.toBeVisible();
  await expect(
    page.getByText("Cette commande a déjà été remise à un vendeur", { exact: false }),
  ).toBeVisible();

  // Payment/fulfilment independence: delivered but still unpaid, and
  // this action must never have touched customer payment state.
  await expect(page.getByText("En attente").first()).toBeVisible();

  // The bundle order, bulk-processed alongside the direct order, reached the same terminal state.
  await page.goto(bundleOrderUrl, { waitUntil: "networkidle" });
  await expect(page.getByText("Livrée", { exact: true }).first()).toBeVisible();
});

test("a CLOSED campaign remains fully usable for preparation, handoff and delivery", async ({
  page,
}) => {
  test.setTimeout(90000);

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) throw new Error("requires a seeded ACTIVE campaign");

  const seller = await addTestSellerToActiveCampaign();
  await createAndLogInAsTestAdmin(page, "closed-campaign-admin");
  const orderUrl = await createManualOrder(page, testEmail("closed-campaign"), {
    sellerName: seller.name,
  });

  try {
    await db.update(campaigns).set({ status: "CLOSED" }).where(eq(campaigns.id, campaign.id));

    await page.goto(`/admin/preparation?campaign=${campaign.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText(campaign.name, { exact: true }).first()).toBeVisible();

    await page.goto(orderUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Marquer comme préparée" }).click();
    await expect(page.getByText("Préparée", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Remettre au vendeur" }).click();
    await expect(page.getByText("Remise au vendeur", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Marquer comme livrée" }).click();
    await expect(page.getByText("Livrée", { exact: true }).first()).toBeVisible();
  } finally {
    await db.update(campaigns).set({ status: "ACTIVE" }).where(eq(campaigns.id, campaign.id));
  }
});
