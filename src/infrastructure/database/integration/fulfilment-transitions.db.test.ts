import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  OrderNotCancellableError,
  assignOrderSeller,
  cancelOrder,
  markCustomerPaymentReceived,
} from "@/infrastructure/orders/orders";
import {
  EmptyFulfilmentSelectionError,
  InvalidBulkFulfilmentSelectionError,
  InvalidFulfilmentTransitionError,
  SellerRequiredForHandoffError,
  bulkHandOrdersToSeller,
  bulkMarkOrdersDelivered,
  bulkPrepareOrders,
  handOrderToSeller,
  listCampaignFulfilmentOrders,
  markOrderDelivered,
  markOrderPrepared,
} from "@/infrastructure/fulfilment/fulfilment";
import { OrderNotFoundError } from "@/infrastructure/orders/orders";
import {
  adminUsers,
  campaignProducts,
  campaignSellers,
  campaigns,
  orderEvents,
  orders,
  products,
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

describe("markOrderPrepared — single order", () => {
  it("moves CONFIRMED -> PREPARED, sets preparedAt, and writes an ORDER_PREPARED event with admin identity", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      expect(order.status).toBe("CONFIRMED");

      const before = new Date();
      const updated = await markOrderPrepared(order.id, admin.id, tx);
      expect(updated.status).toBe("PREPARED");
      expect(updated.preparedAt).not.toBeNull();
      expect(updated.preparedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const event = events.find((e) => e.type === "ORDER_PREPARED");
      expect(event).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
    });
  });

  it("allows preparing an unassigned order (central preparation is independent of delivery assignment)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: null });
      expect(order.sellerId).toBeNull();

      const updated = await markOrderPrepared(order.id, admin.id, tx);
      expect(updated.status).toBe("PREPARED");
    });
  });

  it("rejects an unknown order id", async () => {
    await withRollback(async (tx) => {
      const admin = await setupAdmin(tx);
      await expect(markOrderPrepared(randomUUID(), admin.id, tx)).rejects.toThrow(
        OrderNotFoundError,
      );
    });
  });

  it("rejects re-preparing an already-PREPARED order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      await markOrderPrepared(order.id, admin.id, tx);

      await expect(markOrderPrepared(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });

  it("rejects preparing a CANCELLED order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      await cancelOrder(order.id, admin.id, tx);

      await expect(markOrderPrepared(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });
});

describe("handOrderToSeller — single order", () => {
  it("moves PREPARED -> HANDED_TO_SELLER, sets handedToSellerAt, and writes an event", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);

      const before = new Date();
      const updated = await handOrderToSeller(order.id, admin.id, tx);
      expect(updated.status).toBe("HANDED_TO_SELLER");
      expect(updated.handedToSellerAt).not.toBeNull();
      expect(updated.handedToSellerAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const event = events.find((e) => e.type === "ORDER_HANDED_TO_SELLER");
      expect(event).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
    });
  });

  it("rejects handoff for an unassigned order with a distinct, specific error", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: null });
      await markOrderPrepared(order.id, admin.id, tx);

      await expect(handOrderToSeller(order.id, admin.id, tx)).rejects.toThrow(
        SellerRequiredForHandoffError,
      );

      const [row] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(row!.status).toBe("PREPARED");
    });
  });

  it("rejects skipping ahead: CONFIRMED -> HANDED_TO_SELLER directly", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      expect(order.status).toBe("CONFIRMED");

      await expect(handOrderToSeller(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });

  it("rejects handoff for a CANCELLED order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await cancelOrder(order.id, admin.id, tx);

      await expect(handOrderToSeller(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });
});

describe("markOrderDelivered — single order", () => {
  it("moves HANDED_TO_SELLER -> DELIVERED, sets deliveredAt, and writes an event", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);

      const before = new Date();
      const updated = await markOrderDelivered(order.id, admin.id, tx);
      expect(updated.status).toBe("DELIVERED");
      expect(updated.deliveredAt).not.toBeNull();
      expect(updated.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const event = events.find((e) => e.type === "ORDER_DELIVERED");
      expect(event).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
    });
  });

  it("delivery is possible while customer payment remains PENDING (payment/fulfilment independence)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);

      const updated = await markOrderDelivered(order.id, admin.id, tx);
      expect(updated.status).toBe("DELIVERED");
      expect(updated.customerPaymentStatus).toBe("PENDING");
      expect(updated.sellerSettlementStatus).toBe("PENDING");
    });
  });

  it("rejects skipping ahead: CONFIRMED -> DELIVERED directly", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      await expect(markOrderDelivered(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });

  it("rejects skipping ahead: PREPARED -> DELIVERED directly", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      await markOrderPrepared(order.id, admin.id, tx);

      await expect(markOrderDelivered(order.id, admin.id, tx)).rejects.toThrow(
        InvalidFulfilmentTransitionError,
      );
    });
  });
});

describe("bulkPrepareOrders", () => {
  it("prepares every eligible order atomically, one event each", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createTestOrder(tx, campaign.id, product.id);
      const orderB = await createTestOrder(tx, campaign.id, product.id);

      const result = await bulkPrepareOrders(
        { campaignId: campaign.id, orderIds: [orderA.id, orderB.id], adminId: admin.id },
        tx,
      );
      expect(result.count).toBe(2);

      const rows = await tx.select().from(orders).where(eq(orders.campaignId, campaign.id));
      expect(rows.every((row) => row.status === "PREPARED")).toBe(true);
      expect(rows.every((row) => row.preparedAt !== null)).toBe(true);

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.type, "ORDER_PREPARED"));
      expect(events).toHaveLength(2);
    });
  });

  it("rejects an empty selection", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const admin = await setupAdmin(tx);
      await expect(
        bulkPrepareOrders({ campaignId: campaign.id, orderIds: [], adminId: admin.id }, tx),
      ).rejects.toThrow(EmptyFulfilmentSelectionError);
    });
  });

  it("rolls back the whole batch if any member is ineligible (all-or-nothing)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const eligible = await createTestOrder(tx, campaign.id, product.id);
      const alreadyPrepared = await createTestOrder(tx, campaign.id, product.id);
      await markOrderPrepared(alreadyPrepared.id, admin.id, tx);

      await expect(
        bulkPrepareOrders(
          {
            campaignId: campaign.id,
            orderIds: [eligible.id, alreadyPrepared.id],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidBulkFulfilmentSelectionError);

      const [row] = await tx.select().from(orders).where(eq(orders.id, eligible.id));
      expect(row!.status).toBe("CONFIRMED");
    });
  });

  it("rejects a selection mixing orders from a different campaign", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const inCampaign = await createTestOrder(tx, campaign.id, product.id);

      const otherCampaign = await setupActiveCampaign(tx);
      const otherProduct = await setupProduct(tx, otherCampaign.id);
      const outsideCampaign = await createTestOrder(tx, otherCampaign.id, otherProduct.id);

      await expect(
        bulkPrepareOrders(
          {
            campaignId: campaign.id,
            orderIds: [inCampaign.id, outsideCampaign.id],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidBulkFulfilmentSelectionError);
    });
  });
});

describe("bulkHandOrdersToSeller", () => {
  it("hands off every eligible order for one seller atomically", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      const orderB = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(orderA.id, admin.id, tx);
      await markOrderPrepared(orderB.id, admin.id, tx);

      const result = await bulkHandOrdersToSeller(
        {
          campaignId: campaign.id,
          sellerId: seller.id,
          orderIds: [orderA.id, orderB.id],
          adminId: admin.id,
        },
        tx,
      );
      expect(result.count).toBe(2);

      const rows = await tx.select().from(orders).where(eq(orders.sellerId, seller.id));
      expect(rows.every((row) => row.status === "HANDED_TO_SELLER")).toBe(true);
      expect(rows.every((row) => row.handedToSellerAt !== null)).toBe(true);
    });
  });

  it("rejects mixed-seller selections — no order belonging to another seller may be included", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerA.id });
      const orderB = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerB.id });
      await markOrderPrepared(orderA.id, admin.id, tx);
      await markOrderPrepared(orderB.id, admin.id, tx);

      await expect(
        bulkHandOrdersToSeller(
          {
            campaignId: campaign.id,
            sellerId: sellerA.id,
            orderIds: [orderA.id, orderB.id],
            adminId: admin.id,
          },
          tx,
        ),
      ).rejects.toThrow(InvalidBulkFulfilmentSelectionError);

      const [rowA] = await tx.select().from(orders).where(eq(orders.id, orderA.id));
      expect(rowA!.status).toBe("PREPARED");
    });
  });
});

describe("bulkMarkOrdersDelivered", () => {
  it("delivers every eligible order for one seller atomically", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const orderA = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      const orderB = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      for (const order of [orderA, orderB]) {
        await markOrderPrepared(order.id, admin.id, tx);
        await handOrderToSeller(order.id, admin.id, tx);
      }

      const result = await bulkMarkOrdersDelivered(
        {
          campaignId: campaign.id,
          sellerId: seller.id,
          orderIds: [orderA.id, orderB.id],
          adminId: admin.id,
        },
        tx,
      );
      expect(result.count).toBe(2);

      const rows = await tx.select().from(orders).where(eq(orders.sellerId, seller.id));
      expect(rows.every((row) => row.status === "DELIVERED")).toBe(true);
      expect(rows.every((row) => row.deliveredAt !== null)).toBe(true);

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.type, "ORDER_DELIVERED"));
      expect(events).toHaveLength(2);
    });
  });
});

describe("existing Phase 8 guards remain intact under Phase 9 fulfilment progress", () => {
  it("PAID orders still cannot be cancelled, regardless of fulfilment progress", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);
      await markOrderDelivered(order.id, admin.id, tx);
      await markCustomerPaymentReceived(order.id, admin.id, tx);

      await expect(cancelOrder(order.id, admin.id, tx)).rejects.toThrow(OrderNotCancellableError);
    });
  });

  it("an unpaid order remains cancellable even once DELIVERED (no new fulfilment-based cancellation block)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);
      await markOrderDelivered(order.id, admin.id, tx);

      const cancelled = await cancelOrder(order.id, admin.id, tx);
      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  it("seller reassignment remains allowed once HANDED_TO_SELLER (unsettled) — no new fulfilment-based block", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerA.id });
      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);

      const reassigned = await assignOrderSeller(order.id, sellerB.id, admin.id, tx);
      expect(reassigned.sellerId).toBe(sellerB.id);
    });
  });
});

describe("listCampaignFulfilmentOrders — campaign scoping and CANCELLED exclusion", () => {
  it("only returns orders for the requested campaign, excluding CANCELLED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const kept = await createTestOrder(tx, campaign.id, product.id);
      const cancelled = await createTestOrder(tx, campaign.id, product.id);
      await cancelOrder(cancelled.id, admin.id, tx);

      const otherCampaign = await setupActiveCampaign(tx);
      const otherProduct = await setupProduct(tx, otherCampaign.id);
      await createTestOrder(tx, otherCampaign.id, otherProduct.id);

      const rows = await listCampaignFulfilmentOrders(campaign.id, tx);
      const ids = rows.map((row) => row.order.id);
      expect(ids).toContain(kept.id);
      expect(ids).not.toContain(cancelled.id);
      expect(rows).toHaveLength(1);
    });
  });
});

describe("CLOSED campaign fulfilment", () => {
  it("every single-order transition works identically once the campaign is CLOSED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });

      await tx.update(campaigns).set({ status: "CLOSED" }).where(eq(campaigns.id, campaign.id));

      await markOrderPrepared(order.id, admin.id, tx);
      await handOrderToSeller(order.id, admin.id, tx);
      const delivered = await markOrderDelivered(order.id, admin.id, tx);
      expect(delivered.status).toBe("DELIVERED");

      const rows = await listCampaignFulfilmentOrders(campaign.id, tx);
      expect(rows).toHaveLength(1);
    });
  });
});
