import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 4 Gate 2: focused browser coverage for the real public catalog
// against the same local Postgres the dev server (playwright.config.ts's
// webServer) uses. Keeps to the requested scope — no cart/checkout
// tests, since neither exists yet.
//
// Several tests here temporarily mutate the shared dev campaign's state
// (status, campaign_products.active, bundles.active) to exercise the
// no-active-campaign / zero-visible-products / no-bundle states against
// the real, single seeded campaign — the `campaigns_one_active_idx`
// invariant (drizzle/0002) means a *second* ACTIVE campaign can't be
// created alongside it, so "no active campaign" can only be exercised
// by temporarily flipping the existing one. Every such test restores
// the original state in a `finally` block, and the whole file runs
// serially to avoid any of these tests overlapping with each other.
config({ path: ".env.local" });

const { db } = await import("../src/infrastructure/database/client");
const { bundles, campaignProducts, campaigns } =
  await import("../src/infrastructure/database/schema");
const { eq } = await import("drizzle-orm");

test.describe.configure({ mode: "serial" });

async function getActiveCampaign() {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) {
    throw new Error(
      "This suite requires a seeded ACTIVE campaign (run `pnpm db:seed` if the local DB is empty).",
    );
  }
  return campaign;
}

test("anonymous visitor can load / and browse the active campaign catalog, no authentication required", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  // The seeded campaign's own wines — proves real DB data renders, not
  // a static mock (this is the one place a seeded name is expected: an
  // assertion on rendered output, not production component source).
  await expect(page.getByRole("heading", { name: "Chasselas", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("no purchase/cart control appears anywhere on the page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /ajouter/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /ajouter/i })).toHaveCount(0);
});

test("missing product images render the editorial placeholder with a meaningful label", async ({
  page,
}) => {
  await page.goto("/");
  // Every seeded product currently has imageUrl = null. Chasselas
  // legitimately appears twice (its own wine row + inside the
  // Discovery Box composition) — scope to the wine collection.
  await expect(
    page.locator("#selection").getByRole("img", { name: "Photo provisoire — Chasselas" }),
  ).toBeVisible();
});

test("the Discovery Box renders the real database composition", async ({ page }) => {
  await page.goto("/");
  const discoveryBox = page.getByRole("region", { name: "Cartons découverte" });
  await expect(discoveryBox.getByRole("heading", { name: "Carton découverte" })).toBeVisible();
  await expect(discoveryBox.getByText("Chasselas")).toBeVisible();
});

test("the Discovery Box disappears when no bundle is active — never a partial/broken box", async ({
  page,
}) => {
  const campaign = await getActiveCampaign();
  const activeBundles = await db.select().from(bundles).where(eq(bundles.campaignId, campaign.id));

  try {
    for (const bundle of activeBundles) {
      await db.update(bundles).set({ active: false }).where(eq(bundles.id, bundle.id));
    }

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Carton découverte" })).not.toBeVisible();
    // The wine collection itself must still be there — only the bundle disappeared.
    await expect(page.getByRole("heading", { name: "Chasselas", level: 3 })).toBeVisible();
  } finally {
    for (const bundle of activeBundles) {
      await db.update(bundles).set({ active: true }).where(eq(bundles.id, bundle.id));
    }
  }
});

test("an active campaign with zero visible products shows a calm notice, never an empty grid", async ({
  page,
}) => {
  const campaign = await getActiveCampaign();
  const activeCampaignProducts = await db
    .select()
    .from(campaignProducts)
    .where(eq(campaignProducts.campaignId, campaign.id));

  try {
    for (const cp of activeCampaignProducts) {
      await db
        .update(campaignProducts)
        .set({ active: false })
        .where(eq(campaignProducts.id, cp.id));
    }

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Chasselas", level: 3 })).not.toBeVisible();
    await expect(page.getByText(/sélection.*sera annoncée/i)).toBeVisible();
    // Still shows campaign identity — this is not the no-active-campaign state.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  } finally {
    for (const cp of activeCampaignProducts) {
      await db.update(campaignProducts).set({ active: true }).where(eq(campaignProducts.id, cp.id));
    }
  }
});

test("no-active-campaign state renders a polished business page without crashing", async ({
  page,
}) => {
  const campaign = await getActiveCampaign();

  try {
    await db.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.id, campaign.id));

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("La vente de vins n'est actuellement pas ouverte.")).toBeVisible();
    // Never leaks the internal status value to the page.
    await expect(page.getByText("DRAFT")).not.toBeVisible();
  } finally {
    await db.update(campaigns).set({ status: "ACTIVE" }).where(eq(campaigns.id, campaign.id));
  }
});
