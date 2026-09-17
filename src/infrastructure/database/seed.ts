/**
 * Development seed script (docs/10-IMPLEMENTATION-PLAN.md Phase 2 §23).
 *
 * Entirely fictional/demo data — one campaign, ~6 wines, a discovery
 * bundle, a handful of sellers. Never seeds Orders/Payments/Settlements
 * (CLAUDE.md §58 — no fake commercial data, ever).
 *
 * Run with `pnpm db:seed`. Requires DATABASE_URL/DATABASE_DRIVER to
 * point at a real (development) database — this script refuses to run
 * against production and is never invoked automatically by the app,
 * build, migrations, or deployment.
 *
 * NOT idempotent by design (fixed slugs/names describing one specific
 * demo campaign) — running it twice against the same database is
 * expected to fail. The whole seed runs inside one transaction
 * specifically so that failure is safe: either everything is inserted,
 * or (e.g. on a second run, hitting the campaign's unique slug)
 * nothing is, never a partial demo dataset.
 */
import { config } from "dotenv";

// Run via `tsx` directly (not Next.js), so .env.local is not loaded
// automatically — load it before importing the database client.
config({ path: ".env.local" });

const { db } = await import("./client");
const { bundleItems, bundles, campaignProducts, campaignSellers, campaigns, products, sellers } =
  await import("./schema");

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the development seed script with NODE_ENV=production.");
}

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
