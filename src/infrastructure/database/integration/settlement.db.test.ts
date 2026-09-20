import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import { markCustomerPaymentReceived } from "@/infrastructure/orders/orders";
import {
  EmptySettlementSelectionError,
  InvalidSettlementOrderError,
  createSettlement,
} from "@/infrastructure/settlements/settlements";
import {
  adminUsers,
  campaignProducts,
  campaignSellers,
  campaigns,
  orderEvents,
  orders,
  products,
  sellerSettlementOrders,
  sellerSettlements,
  sellers,
} from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

async function setupActiveCampaign(tx: Tx, overrides: Partial<typeof campaigns.$inferInsert> = {}) {
  await neutralizeExistingActiveCampaigns(tx);
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE", ...overrides })
    .returning();
  if (!campaign) throw new Error("fixture insert failed");
  return campaign;
}

async function setupProduct(tx: Tx, campaignId: string, unitPriceAmount = 1_800) {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique("wine"), name: unique("Wine"), category: "WHITE", active: true })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await tx
    .insert(campaignProducts)
    .values({ campaignId, productId: product.id, unitPriceAmount, active: true });
  return product;
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

async function createTestOrder(
  tx: Tx,
  campaignId: string,
  productId: string,
  overrides: Partial<CreateOrderInput> = {},
) {
  const result = await createOrder(
    customerInput({ items: [{ type: "PRODUCT", id: productId, quantity: 1 }], ...overrides }),
    { type: "SYSTEM" },
    "ONLINE",
    tx,
  );
  if (result.status !== "created")
    throw new Error(`fixture order creation failed: ${JSON.stringify(result)}`);
  return result.order;
}

/** A PAID, seller-assigned, settlement-eligible order — the common fixture shape this whole file builds on. */
async function createEligibleOrder(
  tx: Tx,
  campaignId: string,
  productId: string,
  sellerId: string,
  admin: { id: string },
) {
  const order = await createTestOrder(tx, campaignId, productId, { sellerId });
  return markCustomerPaymentReceived(order.id, admin.id, tx);
}

describe("createSettlement — success", () => {
  it("settles a single order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id, 1_800);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      const settlement = await createSettlement(
        { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
        tx,
      );
      expect(settlement.status).toBe("SETTLED");
      expect(settlement.amount).toBe(1_800);
      expect(settlement.settledAt).not.toBeNull();
      expect(settlement.recordedByAdminUserId).toBe(admin.id);

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(updatedOrder?.sellerSettlementStatus).toBe("SETTLED");

      const links = await tx
        .select()
        .from(sellerSettlementOrders)
        .where(eq(sellerSettlementOrders.sellerSettlementId, settlement.id));
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({ orderId: order.id, amount: 1_800 });

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const settlementEvent = events.find((e) => e.type === "SETTLEMENT_COMPLETED");
      expect(settlementEvent).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
      expect(
        (settlementEvent?.metadata as { sellerSettlementId?: string })?.sellerSettlementId,
      ).toBe(settlement.id);
    });
  });

  it("settles multiple orders for the same seller, deriving the authoritative summed amount server-side", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id, 2_000);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);
      const orderB = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);
      const orderC = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      // Partial remittance (docs/08 §38): only A and B are remitted now.
      const settlement = await createSettlement(
        {
          campaignId: campaign.id,
          sellerId: seller.id,
          orderIds: [orderA.id, orderB.id],
          adminId: admin.id,
        },
        tx,
      );
      expect(settlement.amount).toBe(4_000);

      const [updatedA] = await tx.select().from(orders).where(eq(orders.id, orderA.id));
      const [updatedB] = await tx.select().from(orders).where(eq(orders.id, orderB.id));
      const [updatedC] = await tx.select().from(orders).where(eq(orders.id, orderC.id));
      expect(updatedA?.sellerSettlementStatus).toBe("SETTLED");
      expect(updatedB?.sellerSettlementStatus).toBe("SETTLED");
      expect(updatedC?.sellerSettlementStatus).toBe("PENDING");

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.type, "SETTLEMENT_COMPLETED"));
      expect(events.filter((e) => e.orderId === orderA.id || e.orderId === orderB.id)).toHaveLength(
        2,
      );
    });
  });

  it("de-duplicates a repeated order id within one submission rather than erroring", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      const settlement = await createSettlement(
        {
          campaignId: campaign.id,
          sellerId: seller.id,
          orderIds: [order.id, order.id],
          adminId: admin.id,
        },
        tx,
      );
      expect(settlement.amount).toBe(1_800);
      const links = await tx
        .select()
        .from(sellerSettlementOrders)
        .where(eq(sellerSettlementOrders.sellerSettlementId, settlement.id));
      expect(links).toHaveLength(1);
    });
  });
});

describe("createSettlement — rejections (whole transaction rolls back)", () => {
  it("rejects an empty order selection", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);

      await expect(
        createSettlement(
          { campaignId: campaign.id, sellerId: seller.id, orderIds: [], adminId: admin.id },
          tx,
        ),
      ).rejects.toThrow(EmptySettlementSelectionError);
    });
  });

  it("rejects a mixed-seller selection, leaving BOTH orders untouched", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createEligibleOrder(tx, campaign.id, product.id, sellerA.id, admin);
      const orderB = await createEligibleOrder(tx, campaign.id, product.id, sellerB.id, admin);

      await expect(
        createSettlement(
          {
            campaignId: campaign.id,
            sellerId: sellerA.id,
            orderIds: [orderA.id, orderB.id],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);

      const [refetchedA] = await tx.select().from(orders).where(eq(orders.id, orderA.id));
      const [refetchedB] = await tx.select().from(orders).where(eq(orders.id, orderB.id));
      expect(refetchedA?.sellerSettlementStatus).toBe("PENDING");
      expect(refetchedB?.sellerSettlementStatus).toBe("PENDING");
      const allSettlements = await tx
        .select()
        .from(sellerSettlements)
        .where(eq(sellerSettlements.sellerId, sellerA.id));
      expect(allSettlements).toHaveLength(0);
    });
  });

  it("rejects a mixed-campaign selection", async () => {
    await withRollback(async (tx) => {
      const campaignA = await setupActiveCampaign(tx);
      const productA = await setupProduct(tx, campaignA.id);
      const seller = await setupSeller(tx, campaignA.id);
      const admin = await setupAdmin(tx);
      const orderA = await createEligibleOrder(tx, campaignA.id, productA.id, seller.id, admin);

      // A second campaign, now made active in its place — orderB belongs to campaignB.
      const campaignB = await setupActiveCampaign(tx);
      const productB = await setupProduct(tx, campaignB.id);
      await tx
        .insert(campaignSellers)
        .values({ campaignId: campaignB.id, sellerId: seller.id, active: true });
      const orderB = await createEligibleOrder(tx, campaignB.id, productB.id, seller.id, admin);

      await expect(
        createSettlement(
          {
            campaignId: campaignA.id,
            sellerId: seller.id,
            orderIds: [orderA.id, orderB.id],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);

      const [refetchedA] = await tx.select().from(orders).where(eq(orders.id, orderA.id));
      expect(refetchedA?.sellerSettlementStatus).toBe("PENDING");
    });
  });

  it("rejects an unpaid (PENDING customer payment) order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });

      await expect(
        createSettlement(
          { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);
    });
  });

  it("rejects an unassigned order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: null });
      await markCustomerPaymentReceived(order.id, admin.id, tx);

      await expect(
        createSettlement(
          { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);
    });
  });

  it("rejects a cancelled order even if it was paid before cancellation (defense in depth)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      // Unreachable via the app's own cancelOrder() now that Phase 8
      // blocks cancelling a PAID order — construct the row directly to
      // prove the settlement transaction still refuses to settle it.
      await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, order.id));

      await expect(
        createSettlement(
          { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);
    });
  });

  it("rejects an already-settled order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      await createSettlement(
        { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
        tx,
      );

      await expect(
        createSettlement(
          { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);
    });
  });

  it("an unknown order id rejects the whole request", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createEligibleOrder(tx, campaign.id, product.id, seller.id, admin);

      await expect(
        createSettlement(
          {
            campaignId: campaign.id,
            sellerId: seller.id,
            orderIds: [order.id, randomUUID()],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidSettlementOrderError);

      const [refetched] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(refetched?.sellerSettlementStatus).toBe("PENDING");
    });
  });
});
