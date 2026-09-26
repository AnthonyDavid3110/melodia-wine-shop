import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import { cancelOrder } from "@/infrastructure/orders/orders";
import {
  listStatisticsRelevantCampaigns,
  resolveDefaultStatisticsCampaign,
} from "@/infrastructure/campaign/campaigns";
import { getCampaignItemSalesBreakdown } from "@/infrastructure/statistics/statistics";
import { listCampaignSellerSalesSummaries } from "@/infrastructure/settlements/settlements";
import {
  adminUsers,
  bundleItems,
  bundles,
  campaignProducts,
  campaignSellers,
  campaigns,
  payments,
  products,
  sellers,
} from "../schema";
import { createOrder as insertRawOrder, unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupCampaign(
  tx: Tx,
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED" = "ACTIVE",
) {
  if (status === "ACTIVE") {
    await neutralizeExistingActiveCampaigns(tx);
  }
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status })
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

async function setupSeller(tx: Tx, campaignId: string) {
  const [seller] = await tx
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique("Seller"), active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  await tx.insert(campaignSellers).values({ campaignId, sellerId: seller.id, active: true });
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

describe("listStatisticsRelevantCampaigns / resolveDefaultStatisticsCampaign", () => {
  it("includes ACTIVE, CLOSED, and ARCHIVED, and excludes DRAFT", async () => {
    await withRollback(async (tx) => {
      const active = await setupCampaign(tx, "ACTIVE");
      const closed = await setupCampaign(tx, "CLOSED");
      const archived = await setupCampaign(tx, "ARCHIVED");
      const draft = await setupCampaign(tx, "DRAFT");

      const relevant = await listStatisticsRelevantCampaigns(tx);
      const ids = relevant.map((c) => c.id);
      expect(ids).toEqual(expect.arrayContaining([active.id, closed.id, archived.id]));
      expect(ids).not.toContain(draft.id);
    });
  });

  it("defaults to the ACTIVE campaign when one exists", async () => {
    await withRollback(async (tx) => {
      const active = await setupCampaign(tx, "ACTIVE");
      await setupCampaign(tx, "ARCHIVED");

      const resolved = await resolveDefaultStatisticsCampaign(tx);
      expect(resolved?.id).toBe(active.id);
    });
  });

  it("falls back to the most recent historical campaign WITH orders over one with none, when nothing is ACTIVE", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const emptyArchived = await setupCampaign(tx, "ARCHIVED");
      const closedWithOrders = await setupCampaign(tx, "CLOSED");
      await insertRawOrder(tx, closedWithOrders.id);
      void emptyArchived;

      const resolved = await resolveDefaultStatisticsCampaign(tx);
      expect(resolved?.id).toBe(closedWithOrders.id);
    });
  });

  it("returns null when no ACTIVE/CLOSED/ARCHIVED campaign exists at all", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "CLOSED"));
      await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ARCHIVED"));

      const resolved = await resolveDefaultStatisticsCampaign(tx);
      expect(resolved).toBeNull();
    });
  });
});

describe("getCampaignItemSalesBreakdown", () => {
  it("scopes strictly to the requested campaign and uses order-time name snapshots", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id, "Chasselas");
      await createTestOrder(tx, { items: [{ type: "PRODUCT", id: wine.id, quantity: 2 }] });

      const otherCampaign = await setupCampaign(tx);
      const otherWine = await setupProduct(tx, otherCampaign.id, "Pinot Noir");
      await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: otherWine.id, quantity: 5 }],
      });

      const rows = await getCampaignItemSalesBreakdown(campaign.id, tx);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.nameSnapshot).toBe("Chasselas");
      expect(rows[0]!.quantity).toBe(2);
    });
  });

  it("includes CANCELLED order items (exclusion is the caller's responsibility)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, {
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await cancelOrder(order.id, admin.id, tx);

      const rows = await getCampaignItemSalesBreakdown(campaign.id, tx);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.orderStatus).toBe("CANCELLED");
    });
  });

  it("returns a BUNDLE row with its own snapshot, distinct from PRODUCT rows", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const bundle = await setupBundle(tx, campaign.id, [{ productId: wine.id, quantity: 6 }]);
      await createTestOrder(tx, { items: [{ type: "BUNDLE", id: bundle.id, quantity: 2 }] });

      const rows = await getCampaignItemSalesBreakdown(campaign.id, tx);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.itemType).toBe("BUNDLE");
      expect(rows[0]!.bundleId).toBe(bundle.id);
      expect(rows[0]!.quantity).toBe(2);
    });
  });

  it("returns an empty array for a campaign with no orders", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const rows = await getCampaignItemSalesBreakdown(campaign.id, tx);
      expect(rows).toEqual([]);
    });
  });
});

describe("listCampaignSellerSalesSummaries — onlinePaidSales (BR-COL-002)", () => {
  it("attributes a SUCCEEDED TWINT/CARD order's value to the assigned seller's online-paid sales", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await tx.insert(payments).values({
        orderId: order.id,
        method: "TWINT",
        provider: "SAFERPAY",
        amount: order.totalAmount,
        status: "SUCCEEDED",
        paidAt: new Date(),
      });

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.onlinePaidSales).toBe(order.totalAmount);
    });
  });

  it("does not double-count a retried payment — only the authoritative attempt counts", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await tx.insert(payments).values([
        {
          orderId: order.id,
          method: "CARD",
          provider: "SAFERPAY",
          amount: order.totalAmount,
          status: "FAILED",
        },
        {
          orderId: order.id,
          method: "CARD",
          provider: "SAFERPAY",
          amount: order.totalAmount,
          status: "SUCCEEDED",
          paidAt: new Date(),
        },
      ]);

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.onlinePaidSales).toBe(order.totalAmount);
    });
  });

  it("never counts a SELLER-payment (offline) order as online-paid sales", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.onlinePaidSales).toBe(0);
    });
  });

  it("never counts a failed/pending-only online attempt as online-paid sales", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const order = await createTestOrder(tx, {
        sellerId: seller.id,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });
      await tx.insert(payments).values({
        orderId: order.id,
        method: "TWINT",
        provider: "SAFERPAY",
        amount: order.totalAmount,
        status: "FAILED",
      });

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const summary = summaries.find((row) => row.sellerId === seller.id)!;
      expect(summary.onlinePaidSales).toBe(0);
    });
  });

  it("gives the synthetic unassigned row zero target/progress, never 0%", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupCampaign(tx);
      const wine = await setupProduct(tx, campaign.id);
      await createTestOrder(tx, {
        sellerId: null,
        items: [{ type: "PRODUCT", id: wine.id, quantity: 1 }],
      });

      const summaries = await listCampaignSellerSalesSummaries(campaign.id, tx);
      const unassigned = summaries.find((row) => row.sellerId === null)!;
      expect(unassigned.target).toBeNull();
      expect(unassigned.progressPercentage).toBeNull();
    });
  });
});
