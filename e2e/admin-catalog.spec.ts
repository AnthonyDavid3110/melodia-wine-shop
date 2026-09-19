import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 5 Gate 2A: focused browser coverage for the new Product and
// Campaign master-data admin UI — real form submission, real server
// actions, real database, against the dev server started by
// playwright.config.ts's webServer. Deliberately narrow: the create,
// edit, and lifecycle-transition paths that exercise the new Server
// Actions end-to-end, not an exhaustive UI audit (unit/domain tests
// already cover validation edge cases and DB integration tests already
// cover the infrastructure layer directly).
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  adminUsers,
  authAccounts,
  authSessions,
  authUsers,
  campaigns,
  campaignEvents,
  campaignProducts,
  campaignSellers,
  bundles,
  bundleItems,
  products,
  sellers,
} = await import("../src/infrastructure/database/schema");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");
const { eq, inArray } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const PASSWORD = "correct-horse-battery-1";
const createdAdminEmails: string[] = [];
const createdProductIds: string[] = [];
const createdCampaignIds: string[] = [];
const createdBundleIds: string[] = [];
const createdSellerIds: string[] = [];

async function createAndLogInAsAdmin(page: import("@playwright/test").Page, label: string) {
  const email = `${unique(label)}@example.test`;
  createdAdminEmails.push(email);
  await bootstrapAdmin({ email, name: `E2E ${label}`, password: PASSWORD });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  // Next.js dev mode compiles each route on first visit — the admin
  // home page pulls in the new campaign-readiness query graph, so its
  // first compile can exceed the default 5s expect timeout. Generous
  // here, not elsewhere, since only first-visits-per-route need it.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
}

test.afterAll(async () => {
  // RESTRICT foreign keys mean children must go before parents:
  // bundleItems -> bundles/campaignProducts/campaignSellers/campaignEvents
  // -> campaigns -> products/sellers. Scoped by campaignId, not by row
  // count, so this cleans up everything a test created (including a
  // bulk-add's rows) even if a test failed partway through.
  if (createdBundleIds.length > 0) {
    await db.delete(bundleItems).where(inArray(bundleItems.bundleId, createdBundleIds));
    await db.delete(bundles).where(inArray(bundles.id, createdBundleIds));
  }
  if (createdCampaignIds.length > 0) {
    await db
      .delete(campaignProducts)
      .where(inArray(campaignProducts.campaignId, createdCampaignIds));
    await db.delete(campaignSellers).where(inArray(campaignSellers.campaignId, createdCampaignIds));
    await db.delete(campaignEvents).where(inArray(campaignEvents.campaignId, createdCampaignIds));
    await db.delete(campaigns).where(inArray(campaigns.id, createdCampaignIds));
  }
  if (createdProductIds.length > 0) {
    await db.delete(products).where(inArray(products.id, createdProductIds));
  }
  if (createdSellerIds.length > 0) {
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

test("an admin can create, edit, and deactivate a product", async ({ page }) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "product-crud");

  const name = unique("Chasselas E2E");

  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Catégorie").fill("WHITE");
  await page.getByRole("button", { name: "Créer le produit" }).click();

  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  // Registered for cleanup immediately once the id is known — before
  // any further assertion that could throw and skip it (Gate 2C §0:
  // cleanup must be robust even when the test fails partway through).
  const productId = page.url().split("/").pop()!;
  createdProductIds.push(productId);

  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Actif")).toBeVisible({ timeout: 15000 });

  // Gate 2C §6: no admin-facing slug field — a slug is generated
  // automatically on create (verified directly against the DB, since
  // it is deliberately not shown anywhere in the UI) and must stay
  // unchanged across a later name edit.
  const [createdRow] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId));
  expect(createdRow?.slug).toBeTruthy();
  expect(createdRow?.slug).not.toBe("");

  const updatedName = `${name} — modifié`;
  await page.getByLabel("Nom").fill(updatedName);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  // Generous timeouts from here on: each of these follows a real Server
  // Action round trip (mutation + revalidatePath + Server Component
  // re-render), which under Next.js dev-mode cold compilation — worse
  // still when several Playwright workers hit the dev server at once —
  // can comfortably exceed the default 5s expect timeout without any
  // actual bug being involved.
  await expect(page.getByText("Produit enregistré.")).toBeVisible({ timeout: 15000 });

  const [updatedRow] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId));
  expect(updatedRow?.slug).toBe(createdRow?.slug);

  await page.getByRole("button", { name: "Désactiver" }).click();
  await expect(page.getByText("Inactif")).toBeVisible({ timeout: 15000 });

  await page.goto("/admin/produits");
  await expect(page.getByRole("link", { name: updatedName })).toBeVisible({ timeout: 15000 });
});

test("an admin can create a campaign and drive its lifecycle through the admin UI", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "campaign-lifecycle");

  // This suite runs against a real, possibly shared dev database (it may
  // already carry a real seeded ACTIVE campaign, or another e2e spec
  // file may transiently flip the real campaign's status mid-run) —
  // never assume a clean slate, and never touch a campaign this test
  // didn't create itself (CLAUDE.md §56). Reading "is another campaign
  // ACTIVE" once and branching on that snapshot would be a
  // time-of-check-to-time-of-use race against exactly that kind of
  // concurrent mutation, so instead this waits for the *actual* outcome
  // of the activation attempt — the same friendly-pre-check-plus-real-
  // backstop design `transitionCampaignStatus` itself uses — and
  // branches on what genuinely happened.
  const label = "Campagne E2E";
  await page.goto("/admin/campagne/nouveau");
  await page.getByLabel("Nom").fill(unique(label));
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(page).toHaveURL(/\/admin\/campagne\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const newCampaignId = page.url().split("/").pop()!;
  createdCampaignIds.push(newCampaignId);
  await expect(page.getByText("Brouillon")).toBeVisible();

  // Gate 2C §6: no admin-facing slug field — a slug is generated
  // automatically on create (verified directly against the DB) and
  // must stay unchanged across a later name edit.
  const [createdCampaignRow] = await db
    .select({ slug: campaigns.slug })
    .from(campaigns)
    .where(eq(campaigns.id, newCampaignId));
  expect(createdCampaignRow?.slug).toBeTruthy();

  await page.getByLabel("Nom").fill(`${label} — modifié`);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Campagne enregistrée.")).toBeVisible({ timeout: 15000 });

  const [updatedCampaignRow] = await db
    .select({ slug: campaigns.slug })
    .from(campaigns)
    .where(eq(campaigns.id, newCampaignId));
  expect(updatedCampaignRow?.slug).toBe(createdCampaignRow?.slug);

  await page.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Activer", exact: true }).click();

  // Generous timeouts from here on: each follows a real
  // `transitionCampaignStatus` Server Action round trip (transaction +
  // revalidatePath + Server Component re-render), which under Next.js
  // dev-mode cold compilation — worse still under parallel Playwright
  // workers — can comfortably exceed the default 5s expect timeout
  // without any actual bug being involved.
  const blocked = page.getByText(/Une autre campagne est déjà active/);
  const published = page.getByText("Cette campagne est actuellement publiée.");
  const activationWasBlocked = await Promise.race([
    blocked.waitFor({ state: "visible", timeout: 15000 }).then(() => true),
    published.waitFor({ state: "visible", timeout: 15000 }).then(() => false),
  ]);

  if (activationWasBlocked) {
    await expect(blocked).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Retour" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Brouillon")).toBeVisible();
    return;
  }

  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  await expect(published).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Clôturer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clôturer", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Clôturée")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Réouvrir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Réouvrir", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Cette campagne est actuellement publiée.")).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Clôturer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clôturer", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Clôturée")).toBeVisible({ timeout: 15000 });
});

test("an admin can attach a product, build a valid bundle, and configure a seller for an isolated campaign", async ({
  page,
}) => {
  test.setTimeout(90000);
  await createAndLogInAsAdmin(page, "gate2b-flow");

  // Every entity here is created fresh by this test — never the real
  // seeded campaign/product/seller data (Gate 2B isolation rule) — and
  // this campaign is deliberately never activated, so it can never
  // race the real active campaign the way the lifecycle test above
  // must guard against.
  const productName = unique("Cépage E2E");
  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(productName);
  await page.getByLabel("Catégorie").fill("RED");
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  createdProductIds.push(page.url().split("/").pop()!);

  const campaignLabel = "Campagne 2B";
  await page.goto("/admin/campagne/nouveau");
  await page.getByLabel("Nom").fill(unique(campaignLabel));
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(page).toHaveURL(/\/admin\/campagne\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const campaignId = page.url().split("/").pop()!;
  createdCampaignIds.push(campaignId);

  // --- Attach the product to the campaign ---
  // Every section is rendered on this one long campaign page (Gate 2B
  // §14), and "Ajouter à la campagne" is the submit label of both the
  // product-attach and seller-add forms — scope every locator to its
  // own <section> so this never accidentally hits the other one.
  const vinsSection = page.locator("#vins");
  const vendeursSection = page.locator("#vendeurs");

  await vinsSection
    .getByRole("combobox", { name: "Choisir un vin à ajouter à la campagne" })
    .click();
  await page.getByPlaceholder("Rechercher un vin…").fill(productName);
  await page.getByRole("option", { name: productName }).click();
  await vinsSection.getByLabel("Prix (CHF)").fill("22.50");
  await vinsSection.getByRole("button", { name: "Ajouter à la campagne" }).click();

  await expect(vinsSection.getByText(productName)).toBeVisible({ timeout: 15000 });
  const productRow = vinsSection.locator("tr", { hasText: productName });
  await expect(productRow.getByText("Oui")).toBeVisible({ timeout: 15000 });

  // --- Build a bundle from that campaign product ---
  await page.getByRole("link", { name: "Nouveau carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/nouveau$/, { timeout: 15000 });
  const bundleName = unique("Carton E2E");
  await page.getByLabel("Nom").fill(bundleName);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByRole("button", { name: "Créer le carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  createdBundleIds.push(page.url().split("/").pop()!);

  await expect(page.getByText("Invalide publiquement")).toBeVisible({ timeout: 15000 });

  await page
    .getByRole("combobox", { name: "Choisir un vin à ajouter à la composition du carton" })
    .click();
  await page.getByPlaceholder("Rechercher…").fill(productName);
  await page.getByRole("option", { name: productName }).click();
  await page.getByRole("button", { name: "Enregistrer la composition" }).click();

  await expect(page.getByText("Composition enregistrée.")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Valide publiquement")).toBeVisible({ timeout: 15000 });

  // --- Configure a seller for the campaign ---
  const sellerFirstName = "E2E";
  const sellerLastName = unique("Vendeur");
  await page.goto("/admin/vendeurs/nouveau");
  await page.getByLabel("Prénom").fill(sellerFirstName);
  await page.getByLabel("Nom", { exact: true }).fill(sellerLastName);
  await page.getByRole("button", { name: "Créer le vendeur" }).click();
  await expect(page).toHaveURL(/\/admin\/vendeurs\/[0-9a-f-]{36}$/, { timeout: 15000 });
  createdSellerIds.push(page.url().split("/").pop()!);

  const sellerLabel = `${sellerFirstName} ${sellerLastName}`;
  await page.goto(`/admin/campagne/${campaignId}`);
  await vendeursSection
    .getByRole("combobox", { name: "Choisir un vendeur à ajouter à la campagne" })
    .click();
  await page.getByPlaceholder("Rechercher un vendeur…").fill(sellerLastName);
  await page.getByRole("option", { name: sellerLabel }).click();
  await vendeursSection.getByLabel("Objectif (facultatif)").fill("100.00");
  await vendeursSection.getByRole("button", { name: "Ajouter à la campagne" }).click();

  const sellerRow = vendeursSection.locator("tr", { hasText: sellerLabel });
  await expect(sellerRow).toBeVisible({ timeout: 15000 });
  await expect(sellerRow.getByText("CHF 100.–")).toBeVisible({ timeout: 15000 });
  await expect(sellerRow.getByText("Participe")).toBeVisible({ timeout: 15000 });
});
