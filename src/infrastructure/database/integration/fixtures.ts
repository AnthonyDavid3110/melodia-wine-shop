import { randomUUID } from "node:crypto";
import { bundles, campaignProducts, campaigns, orders, products, sellers } from "../schema";
import type { Tx } from "./setup";

/** Short random suffix so fixture rows never collide across parallel test files/runs. */
function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

/** Minimal valid campaign/product/seller trio most constraint tests build on. */
export async function createBaseFixtures(tx: Tx) {
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign") })
    .returning();
  const [product] = await tx
    .insert(products)
    .values({ slug: unique("product"), name: unique("Product"), category: "WHITE" })
    .returning();
  const [seller] = await tx
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique("Seller") })
    .returning();

  if (!campaign || !product || !seller) {
    throw new Error("Fixture insert returned no row.");
  }

  return { campaign, product, seller };
}

/** A valid campaignProduct row, for tests that need one to already exist. */
export async function createCampaignProduct(tx: Tx, campaignId: string, productId: string) {
  const [campaignProduct] = await tx
    .insert(campaignProducts)
    .values({ campaignId, productId, unitPriceAmount: 1800 })
    .returning();
  if (!campaignProduct) {
    throw new Error("Fixture insert returned no row.");
  }
  return campaignProduct;
}

/** A valid, minimal Order row (ONLINE, unassigned seller, PENDING/NEW). */
export async function createOrder(
  tx: Tx,
  campaignId: string,
  overrides: Partial<typeof orders.$inferInsert> = {},
) {
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber: unique("ECM-TEST"),
      campaignId,
      source: "ONLINE",
      customerFirstName: "Jean",
      customerLastName: "Testeur",
      customerAddress: "Rue Example 1",
      customerPostalCode: "1000",
      customerCity: "Lausanne",
      customerEmail: "jean.testeur@example.test",
      customerPhone: "+41 79 000 00 00",
      subtotalAmount: 1800,
      totalAmount: 1800,
      ...overrides,
    })
    .returning();
  if (!order) {
    throw new Error("Fixture insert returned no row.");
  }
  return order;
}

/** A valid, minimal Bundle row for a campaign. */
export async function createBundle(tx: Tx, campaignId: string) {
  const [bundle] = await tx
    .insert(bundles)
    .values({ campaignId, name: unique("Bundle"), slug: unique("bundle"), priceAmount: 12_000 })
    .returning();
  if (!bundle) {
    throw new Error("Fixture insert returned no row.");
  }
  return bundle;
}

export { unique };
