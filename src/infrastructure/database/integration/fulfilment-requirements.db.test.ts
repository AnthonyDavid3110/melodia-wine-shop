import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import { cancelOrder } from "@/infrastructure/orders/orders";
import { getCampaignWineRequirements } from "@/infrastructure/fulfilment/fulfilment";
import { adminUsers, bundleItems, bundles, campaignProducts, campaigns, products } from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupActiveCampaign(tx: Tx) {
  await neutralizeExistingActiveCampaigns(tx);
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  return campaign;
}

async function setupProduct(tx: Tx, campaignId: string, name?: string, unitPriceAmount = 1_800) {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique("wine"), name: name ?? unique("Wine"), category: "WHITE", active: true })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await tx
    .insert(campaignProducts)
    .values({ campaignId, productId: product.id, unitPriceAmount, active: true });
  return product;
}

async function setupBundle(
  tx: Tx,
  campaignId: string,
  components: Array<{ productId: string; quantity: number }>,
  priceAmount = 10_000,
) {
  const [bundle] = await tx
    .insert(bundles)
    .values({
      campaignId,
      name: unique("Carton"),
      slug: unique("carton"),
      priceAmount,
      active: true,
    })
    .returning();
  if (!bundle) throw new Error("fixture insert failed");
  for (const component of components) {
    await tx.insert(bundleItems).values({
      bundleId: bundle.id,
      productId: component.productId,
      quantity: component.quantity,
    });
  }
  return bundle;
}

async function setupAdmin(tx: Tx) {
  const [admin] = await tx
    .insert(adminUsers)
    .values({ email: `${unique("admin")}@example.test`, name: "Test Admin" })
    .returning();
  if (!admin) throw new Error("fixture insert failed");
  return admin;
}

function customerInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    customerEmail: "jean@example.test",
    customerPhone: "079 000 00 00",
    deliveryNote: "",
    items: [],
    sellerId: null,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function createTestOrder(tx: Tx, overrides: Partial<CreateOrderInput> = {}) {
  const result = await createOrder(customerInput(overrides), { type: "SYSTEM" }, "ONLINE", tx);
  if (result.status !== "created")
    throw new Error(`fixture order creation failed: ${JSON.stringify(result)}`);
  return result.order;
}

describe("getCampaignWineRequirements — direct products", () => {
  it("sums direct product quantities across orders", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Chasselas");
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineA.id, quantity: 3 }] });
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineA.id, quantity: 4 }] });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      expect(requirements).toEqual([{ productId: wineA.id, productName: "Chasselas", bottles: 7 }]);
    });
  });
});

describe("getCampaignWineRequirements — bundle multiplier", () => {
  it("multiplies bundle quantity × quantityPerBundle exactly once (quantityPerBundle = 1)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const wineB = await setupProduct(tx, campaign.id, "Wine B");
      const bundle = await setupBundle(tx, campaign.id, [
        { productId: wineA.id, quantity: 1 },
        { productId: wineB.id, quantity: 1 },
      ]);

      // 2 × Discovery Box, each containing 1 × Wine A + 1 × Wine B.
      await createTestOrder(tx, { items: [{ type: "BUNDLE", id: bundle.id, quantity: 2 }] });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      const byProduct = Object.fromEntries(requirements.map((r) => [r.productId, r.bottles]));
      // Must be exactly 2 each — never 1 (no multiplication) and never 4 (double multiplication).
      expect(byProduct[wineA.id]).toBe(2);
      expect(byProduct[wineB.id]).toBe(2);
    });
  });

  it("multiplies correctly when quantityPerBundle > 1", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const bundle = await setupBundle(tx, campaign.id, [{ productId: wineA.id, quantity: 3 }]);

      // 4 × bundle, each containing 3 × Wine A -> 12 total.
      await createTestOrder(tx, { items: [{ type: "BUNDLE", id: bundle.id, quantity: 4 }] });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      expect(requirements.find((r) => r.productId === wineA.id)?.bottles).toBe(12);
    });
  });

  it("combines direct + bundle-derived contributions for the same wine", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const bundle = await setupBundle(tx, campaign.id, [{ productId: wineA.id, quantity: 1 }]);

      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineA.id, quantity: 10 }] });
      await createTestOrder(tx, { items: [{ type: "BUNDLE", id: bundle.id, quantity: 20 }] });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      // 10 direct + 20 × 1 bundle-derived = 30, matching docs/02 §20's own example.
      expect(requirements.find((r) => r.productId === wineA.id)?.bottles).toBe(30);
    });
  });
});

describe("getCampaignWineRequirements — cancelled exclusion", () => {
  it("excludes CANCELLED orders from the aggregate", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const admin = await setupAdmin(tx);
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineA.id, quantity: 5 }] });
      const cancelledOrder = await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wineA.id, quantity: 99 }],
      });
      await cancelOrder(cancelledOrder.id, admin.id, tx);

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      expect(requirements.find((r) => r.productId === wineA.id)?.bottles).toBe(5);
    });
  });

  it("does NOT exclude based on payment status, settlement status, seller assignment, or preparation status", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      // Unassigned, unpaid, unprepared order — still contributes.
      await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wineA.id, quantity: 6 }],
        sellerId: null,
      });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      expect(requirements.find((r) => r.productId === wineA.id)?.bottles).toBe(6);
    });
  });
});

describe("getCampaignWineRequirements — historical snapshot integrity", () => {
  it("a later product rename does not change the display name or the requirement", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Chasselas Original");
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineA.id, quantity: 5 }] });

      // Product renamed AFTER the order was placed.
      await tx.update(products).set({ name: "Chasselas Renommé" }).where(eq(products.id, wineA.id));

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      const row = requirements.find((r) => r.productId === wineA.id);
      expect(row?.productName).toBe("Chasselas Original");
      expect(row?.bottles).toBe(5);
    });
  });

  it("a later bundle-composition mutation does not change a historical order's requirement contribution", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const wineC = await setupProduct(tx, campaign.id, "Wine C");
      const bundle = await setupBundle(tx, campaign.id, [{ productId: wineA.id, quantity: 1 }]);

      await createTestOrder(tx, { items: [{ type: "BUNDLE", id: bundle.id, quantity: 10 }] });

      // Bundle composition changed AFTER the order: Wine A removed, Wine C added.
      await tx.delete(bundleItems).where(eq(bundleItems.bundleId, bundle.id));
      await tx
        .insert(bundleItems)
        .values({ bundleId: bundle.id, productId: wineC.id, quantity: 1 });

      const requirements = await getCampaignWineRequirements(campaign.id, tx);
      // The historical order must still contribute to Wine A (its snapshot), never Wine C.
      expect(requirements.find((r) => r.productId === wineA.id)?.bottles).toBe(10);
      expect(requirements.find((r) => r.productId === wineC.id)).toBeUndefined();
    });
  });
});

describe("getCampaignWineRequirements — campaign isolation", () => {
  it("never aggregates requirements across campaigns", async () => {
    await withRollback(async (tx) => {
      const campaignA = await setupActiveCampaign(tx);
      const wineInA = await setupProduct(tx, campaignA.id, "Wine In A");
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineInA.id, quantity: 5 }] });

      const campaignB = await setupActiveCampaign(tx);
      const wineInB = await setupProduct(tx, campaignB.id, "Wine In B");
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wineInB.id, quantity: 7 }] });

      const requirementsA = await getCampaignWineRequirements(campaignA.id, tx);
      expect(requirementsA).toEqual([
        { productId: wineInA.id, productName: "Wine In A", bottles: 5 },
      ]);

      const requirementsB = await getCampaignWineRequirements(campaignB.id, tx);
      expect(requirementsB).toEqual([
        { productId: wineInB.id, productName: "Wine In B", bottles: 7 },
      ]);
    });
  });
});
