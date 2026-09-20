import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  InvalidSellerAssignmentError,
  OrderAlreadyCancelledError,
  OrderNotCancellableError,
  SellerReassignmentBlockedError,
  assignOrderSeller,
  cancelOrder,
  getOrderDetail,
  markCustomerPaymentReceived,
  updateOrderCustomerInfo,
} from "@/infrastructure/orders/orders";
import { createSettlement } from "@/infrastructure/settlements/settlements";
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

async function setupActiveCampaign(tx: Tx) {
  await neutralizeExistingActiveCampaigns(tx);
  const [campaign] = await tx
    .insert(campaigns)
    .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
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

describe("updateOrderCustomerInfo", () => {
  it("updates customer fields and writes an ORDER_EDITED event", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const updated = await updateOrderCustomerInfo(
        order.id,
        {
          customerFirstName: "Marie",
          customerLastName: "Martin",
          customerAddress: "Avenue Neuve 3",
          customerPostalCode: "2000",
          customerCity: "Neuchâtel",
          customerEmail: "marie@example.test",
          customerPhone: "079 111 11 11",
          deliveryNote: "Sonner fort",
        },
        admin.id,
        tx,
      );
      expect(updated.customerFirstName).toBe("Marie");
      expect(updated.customerCity).toBe("Neuchâtel");

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const editEvent = events.find((event) => event.type === "ORDER_EDITED");
      expect(editEvent).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
    });
  });
});

describe("assignOrderSeller", () => {
  it("assigns an eligible seller and writes SELLER_ASSIGNED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const updated = await assignOrderSeller(order.id, seller.id, admin.id, tx);
      expect(updated.sellerId).toBe(seller.id);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.find((e) => e.type === "SELLER_ASSIGNED")).toBeDefined();
    });
  });

  it("reassigns to a different eligible seller and writes SELLER_CHANGED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerA.id });

      const updated = await assignOrderSeller(order.id, sellerB.id, admin.id, tx);
      expect(updated.sellerId).toBe(sellerB.id);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.find((e) => e.type === "SELLER_CHANGED")).toBeDefined();
    });
  });

  it("unassigns a seller (sellerId: null) and writes SELLER_CHANGED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });

      const updated = await assignOrderSeller(order.id, null, admin.id, tx);
      expect(updated.sellerId).toBeNull();

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.find((e) => e.type === "SELLER_CHANGED")).toBeDefined();
    });
  });

  it("rejects assigning an ineligible (inactive) seller, never trusting the browser's id", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      // A seller that exists but was never attached to THIS campaign.
      const [foreignSeller] = await tx
        .insert(sellers)
        .values({ firstName: "Foreign", lastName: unique("Seller") })
        .returning();

      await expect(assignOrderSeller(order.id, foreignSeller!.id, admin.id, tx)).rejects.toThrow(
        InvalidSellerAssignmentError,
      );
    });
  });
});

describe("cancelOrder", () => {
  it("cancels an order and writes ORDER_CANCELLED", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const cancelled = await cancelOrder(order.id, admin.id, tx);
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelledAt).not.toBeNull();

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.find((e) => e.type === "ORDER_CANCELLED")).toMatchObject({
        actorType: "ADMIN",
        adminUserId: admin.id,
      });
    });
  });

  it("rejects cancelling an already-cancelled order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      await cancelOrder(order.id, admin.id, tx);
      await expect(cancelOrder(order.id, admin.id, tx)).rejects.toThrow(OrderAlreadyCancelledError);
    });
  });
});

describe("manual orders use the exact same core", () => {
  it("creates a MANUAL order with an ADMIN actor, authoritative pricing, and correct source", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id, 2_200);
      const admin = await setupAdmin(tx);

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 3 }] }),
        { type: "ADMIN", adminUserId: admin.id },
        "MANUAL",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      expect(result.order.source).toBe("MANUAL");
      expect(result.order.totalAmount).toBe(6_600);
      expect(result.items[0]?.unitPriceAmount).toBe(2_200);

      const detail = await getOrderDetail(result.order.id, tx);
      expect(detail?.order.source).toBe("MANUAL");
    });
  });
});

describe("cancelOrder — Phase 8 financial guard", () => {
  it("still allows cancelling an ordinary PENDING/PENDING order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const cancelled = await cancelOrder(order.id, admin.id, tx);
      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  it("blocks cancelling once the customer has paid", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      await markCustomerPaymentReceived(order.id, admin.id, tx);

      await expect(cancelOrder(order.id, admin.id, tx)).rejects.toThrow(OrderNotCancellableError);

      const [refetched] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(refetched?.status).not.toBe("CANCELLED");
    });
  });

  it("blocks cancelling once the seller has settled", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: seller.id });
      await markCustomerPaymentReceived(order.id, admin.id, tx);
      await createSettlement(
        { campaignId: campaign.id, sellerId: seller.id, orderIds: [order.id], adminId: admin.id },
        tx,
      );

      await expect(cancelOrder(order.id, admin.id, tx)).rejects.toThrow(OrderNotCancellableError);
    });
  });
});

describe("assignOrderSeller — Phase 8 financial guard", () => {
  it("still allows reassignment for a PENDING payment / PENDING settlement order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const seller = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const updated = await assignOrderSeller(order.id, seller.id, admin.id, tx);
      expect(updated.sellerId).toBe(seller.id);
    });
  });

  it("still allows reassignment for a PAID payment / PENDING settlement order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerA.id });
      await markCustomerPaymentReceived(order.id, admin.id, tx);

      const updated = await assignOrderSeller(order.id, sellerB.id, admin.id, tx);
      expect(updated.sellerId).toBe(sellerB.id);
    });
  });

  it("blocks reassignment once the order is included in a completed settlement", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const sellerA = await setupSeller(tx, campaign.id);
      const sellerB = await setupSeller(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id, { sellerId: sellerA.id });
      await markCustomerPaymentReceived(order.id, admin.id, tx);
      await createSettlement(
        { campaignId: campaign.id, sellerId: sellerA.id, orderIds: [order.id], adminId: admin.id },
        tx,
      );

      await expect(assignOrderSeller(order.id, sellerB.id, admin.id, tx)).rejects.toThrow(
        SellerReassignmentBlockedError,
      );

      const [refetched] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(refetched?.sellerId).toBe(sellerA.id);
    });
  });
});
