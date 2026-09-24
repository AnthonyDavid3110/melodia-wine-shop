import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  cancelOrder,
  listOrdersForCampaignExport,
  markCustomerPaymentReceived,
} from "@/infrastructure/orders/orders";
import {
  addSellerToCampaign,
  setCampaignSellerActive,
} from "@/infrastructure/campaign/campaign-sellers";
import { setSellerActive } from "@/infrastructure/sellers/sellers";
import {
  createSettlement,
  getSellerFinancialSummary,
  listCampaignSellerSalesSummaries,
} from "@/infrastructure/settlements/settlements";
import {
  adminUsers,
  bundleItems,
  bundles,
  campaignProducts,
  campaigns,
  products,
  sellers,
} from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupCampaign(tx: Tx) {
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

async function setupSeller(tx: Tx) {
  const [seller] = await tx
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique("Seller") })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  return seller;
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
  if (result.status !== "created") {
    throw new Error(`fixture order creation failed: ${JSON.stringify(result)}`);
  }
  return result.order;
}

describe("listOrdersForCampaignExport", () => {
  it("includes a CANCELLED order, unlike the fulfilment-scoped query", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const active = await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wine.id, quantity: 2 }],
      });
      const toCancel = await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await cancelOrder(toCancel.id, admin.id, tx);

      const rows = await listOrdersForCampaignExport(campaign.id, tx);
      const statuses = new Map(rows.map((row) => [row.order.id, row.order.status]));
      expect(statuses.get(active.id)).toBe("CONFIRMED");
      expect(statuses.get(toCancel.id)).toBe("CANCELLED");
    });
  });

  it("returns items (with bundle components) that stay reconcilable with their own order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wineA = await setupProduct(tx, campaign.id, "Wine A");
      const wineB = await setupProduct(tx, campaign.id, "Wine B");
      const bundle = await setupBundle(tx, campaign.id, [
        { productId: wineA.id, quantity: 2 },
        { productId: wineB.id, quantity: 1 },
      ]);
      const order = await createTestOrder(tx, {
        items: [{ type: "BUNDLE", id: bundle.id, quantity: 3 }],
      });

      const rows = await listOrdersForCampaignExport(campaign.id, tx);
      const row = rows.find((candidate) => candidate.order.id === order.id);
      expect(row).toBeDefined();
      expect(row!.items).toHaveLength(1);
      expect(row!.items[0]!.itemType).toBe("BUNDLE");
      expect(row!.items[0]!.quantity).toBe(3);
      const components = row!.items[0]!.bundleComponents;
      expect(components).toHaveLength(2);
      expect(components.map((c) => c.quantityPerBundle).sort()).toEqual([1, 2]);
    });
  });

  it("returns the full payment set per order (not pre-filtered), including the SELLER row", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const order = await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });

      const rows = await listOrdersForCampaignExport(campaign.id, tx);
      const row = rows.find((candidate) => candidate.order.id === order.id);
      expect(row!.payments).toHaveLength(1);
      expect(row!.payments[0]!.method).toBe("SELLER");
      expect(row!.payments[0]!.status).toBe("PENDING");
    });
  });
});

describe("listCampaignSellerSalesSummaries", () => {
  it("matches getSellerFinancialSummary's own figures for a real seller", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx);
      await addSellerToCampaign(campaign.id, seller.id, 50_000, tx);

      await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 5 }],
      });
      const secondOrder = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 2 }],
      });
      const admin = await setupAdmin(tx);
      await markCustomerPaymentReceived(secondOrder.id, admin.id, tx);

      const expected = await getSellerFinancialSummary(seller.id, campaign.id, tx);
      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id);

      expect(summary).toBeDefined();
      expect(summary!.sales).toBe(expected.sales);
      expect(summary!.target).toBe(expected.target);
      expect(summary!.progressPercentage).toBe(expected.progress);
      expect(summary!.stillToCollect).toBe(expected.stillToCollect);
      expect(summary!.collected).toBe(expected.collected);
      expect(summary!.stillToRemit).toBe(expected.stillToRemit);
      expect(summary!.remittedToEcm).toBe(expected.remittedToEcm);
    });
  });

  it("excludes a CANCELLED order from sales/count, matching calculateSellerSales semantics", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx);
      const admin = await setupAdmin(tx);
      await addSellerToCampaign(campaign.id, seller.id, null, tx);

      const kept = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 3 }],
      });
      const cancelled = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 10 }],
      });
      await cancelOrder(cancelled.id, admin.id, tx);

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.orderCount).toBe(1);
      expect(summary.sales).toBe(kept.totalAmount);
    });
  });

  it("includes the synthetic 'unassigned' pseudo-row for orders with no seller", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const order = await createTestOrder(tx, {
        sellerId: null,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const unassigned = summaries.find((row) => row.sellerId === null);
      expect(unassigned).toBeDefined();
      expect(unassigned!.sellerName).toBeNull();
      expect(unassigned!.target).toBeNull();
      expect(unassigned!.progressPercentage).toBeNull();
      expect(unassigned!.sales).toBe(order.totalAmount);
    });
  });

  it("keeps a globally deactivated seller's historical sales visible", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx);
      await addSellerToCampaign(campaign.id, seller.id, null, tx);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await setSellerActive(seller.id, false, tx);

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id);
      expect(summary).toBeDefined();
      expect(summary!.sales).toBe(order.totalAmount);
    });
  });

  it("keeps a seller removed from the campaign (campaignSellers.active = false) visible", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx);
      const participation = await addSellerToCampaign(campaign.id, seller.id, null, tx);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await setCampaignSellerActive(participation.id, false, tx);

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id);
      expect(summary).toBeDefined();
      expect(summary!.sales).toBe(order.totalAmount);
    });
  });

  it("reflects a real SETTLED settlement in remittedToEcm", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx);
      const admin = await setupAdmin(tx);
      await addSellerToCampaign(campaign.id, seller.id, null, tx);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 4 }],
      });
      await markCustomerPaymentReceived(order.id, admin.id, tx);
      await createSettlement(
        { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
        tx,
      );

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.remittedToEcm).toBe(order.totalAmount);
      expect(summary.stillToRemit).toBe(0);
    });
  });
});
