/**
 * Development seed script (docs/10-IMPLEMENTATION-PLAN.md Phase 2 §23).
 *
 * Entirely fictional/demo data — one campaign, ~6 wines, a discovery
 * bundle, a handful of sellers. Never seeds Orders/Payments/Settlements
 * (CLAUDE.md §58 — no fake commercial data, ever).
 *
 * Run with `ALLOW_DATABASE_SEED=true pnpm db:seed`. Writes to whichever
 * database DATABASE_URL/DATABASE_DRIVER point at (via ./client — the
 * same pooled-URL client the app uses, not DATABASE_URL_UNPOOLED). It
 * refuses, before importing the database client, unless the invoking
 * shell explicitly authorizes it, and always refuses under
 * NODE_ENV=production — see seed-guard.ts. Never invoked automatically
 * by the app, build, migrations, or deployment.
 *
 * NOT idempotent by design (fixed slugs/names describing one specific
 * demo campaign) — running it twice against the same database is
 * expected to fail. The whole seed runs inside one transaction
 * specifically so that failure is safe: either everything is inserted,
 * or (e.g. on a second run, hitting the campaign's unique slug)
 * nothing is, never a partial demo dataset.
 */
import { config } from "dotenv";
import { SEED_AUTHORIZATION_VARIABLE, decideSeedAuthorization } from "./seed-guard";

// Captured before .env.local is loaded, so the authorization can only
// come from the invoking shell — never from a file that would silently
// authorize every future run.
const shellSeedAuthorization = process.env[SEED_AUTHORIZATION_VARIABLE];

// Run via `tsx` directly (not Next.js), so .env.local is not loaded
// automatically — load it before importing the database client.
config({ path: ".env.local" });

const seedAuthorization = decideSeedAuthorization({
  shellAuthorization: shellSeedAuthorization,
  loadedAuthorization: process.env[SEED_AUTHORIZATION_VARIABLE],
  nodeEnv: process.env.NODE_ENV,
});

if (!seedAuthorization.allowed) {
  console.error(seedAuthorization.reason);
  process.exit(1);
}

const { db } = await import("./client");
const { bundleItems, bundles, campaignProducts, campaignSellers, campaigns, products, sellers } =
  await import("./schema");

const demoWines = [
  {
    slug: "chasselas",
    name: "Chasselas",
    producer: "Domaine des Coteaux",
    category: "WHITE" as const,
    vintage: 2025,
    region: "Vaud",
    priceAmount: 1800,
  },
  {
    slug: "chardonnay",
    name: "Chardonnay",
    producer: "Domaine Sainte-Agnès",
    category: "WHITE" as const,
    vintage: 2025,
    region: "Valais",
    priceAmount: 2100,
  },
  {
    slug: "oeil-de-perdrix",
    name: "Œil-de-Perdrix",
    producer: "Cave des Vernes",
    category: "ROSE" as const,
    vintage: 2025,
    region: "Neuchâtel",
    priceAmount: 1900,
  },
  {
    slug: "pinot-noir",
    name: "Pinot Noir",
    producer: "Domaine de la Ronde",
    category: "RED" as const,
    vintage: 2024,
    region: "Vaud",
    priceAmount: 2200,
  },
  {
    slug: "gamaret",
    name: "Gamaret",
    producer: "Cave du Manoir",
    category: "RED" as const,
    vintage: 2024,
    region: "Genève",
    priceAmount: 2400,
  },
  {
    slug: "merlot",
    name: "Merlot",
    producer: "Domaine du Clocher",
    category: "RED" as const,
    vintage: 2023,
    region: "Valais",
    priceAmount: 2600,
  },
];

const demoSellers = [
  { firstName: "Anne", lastName: "Bornand" },
  { firstName: "Marc", lastName: "Favre" },
  { firstName: "Sophie", lastName: "Delacroix" },
  { firstName: "Julien", lastName: "Keller" },
  { firstName: "Claire", lastName: "Girod" },
];

async function seed() {
  console.log("Seeding development data — Les Vins de Mélodia 2026 (fictional demo data)…");

  const summary = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        name: "Les Vins de Mélodia 2026",
        slug: "vente-2026",
        publicTitle: "Les vins de Mélodia — Vente 2026",
        description: "Vente de vins au profit de l'Ensemble de Cuivres Mélodia.",
        status: "ACTIVE",
        defaultSellerTargetAmount: 100_000, // CHF 1'000.–
      })
      .returning();

    if (!campaign) {
      throw new Error("Seed failed: campaign insert returned no row.");
    }

    const insertedProducts = await tx
      .insert(products)
      .values(
        demoWines.map((wine) => ({
          slug: wine.slug,
          name: wine.name,
          producer: wine.producer,
          category: wine.category,
          vintage: wine.vintage,
          region: wine.region,
        })),
      )
      .returning();

    await tx.insert(campaignProducts).values(
      insertedProducts.map((product, index) => ({
        campaignId: campaign.id,
        productId: product.id,
        unitPriceAmount: demoWines[index]!.priceAmount,
        displayOrder: index,
      })),
    );

    const [bundle] = await tx
      .insert(bundles)
      .values({
        campaignId: campaign.id,
        name: "Carton découverte",
        slug: "carton-decouverte-2026",
        shortDescription: "Une bouteille de chacun des six vins de la sélection 2026.",
        priceAmount: 12_000, // CHF 120.–
        displayOrder: 0,
      })
      .returning();

    if (!bundle) {
      throw new Error("Seed failed: bundle insert returned no row.");
    }

    await tx.insert(bundleItems).values(
      insertedProducts.map((product) => ({
        bundleId: bundle.id,
        productId: product.id,
        quantity: 1,
      })),
    );

    const insertedSellers = await tx.insert(sellers).values(demoSellers).returning();

    await tx.insert(campaignSellers).values(
      insertedSellers.map((seller) => ({
        campaignId: campaign.id,
        sellerId: seller.id,
      })),
    );

    return {
      campaigns: 1,
      products: insertedProducts.length,
      bundles: 1,
      sellers: insertedSellers.length,
    };
  });

  console.log(
    `Seed complete: ${summary.campaigns} campaign, ${summary.products} products, ${summary.bundles} bundle, ${summary.sellers} sellers.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed failed (transaction rolled back — nothing partially inserted):", error);
    process.exit(1);
  });
