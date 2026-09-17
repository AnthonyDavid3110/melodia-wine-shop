import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  bundleItems,
  campaignProducts,
  campaignSellers,
  campaigns,
  orderBundleComponents,
  orderItems,
  orders,
  paymentEvents,
  payments,
  products,
  sellerSettlementOrders,
  sellerSettlements,
  sellers,
} from "../schema";
import {
  createBaseFixtures,
  createBundle,
  createCampaignProduct,
  createOrder,
  unique,
} from "./fixtures";
import { withRollback } from "./setup";

// Every test runs inside withRollback: a real PostgreSQL transaction
// that always rolls back at the end, so nothing here persists and
// tests never depend on each other's state or on execution order.
// Operations *expected* to fail use a nested tx.transaction() call
// (a real SAVEPOINT) so the outer transaction survives to make further
// assertions — see integration/setup.ts.

describe("orders.order_number uniqueness", () => {
  it("rejects a duplicate order number", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const orderNumber = unique("ECM-DUP");
      await createOrder(tx, campaign.id, { orderNumber });

      await expect(
        tx.transaction(async (tx2) => {
          await createOrder(tx2, campaign.id, { orderNumber });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("campaign_products uniqueness", () => {
  it("rejects a duplicate (campaign, product) pair", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      await createCampaignProduct(tx, campaign.id, product.id);

      await expect(
        tx.transaction(async (tx2) => {
          await createCampaignProduct(tx2, campaign.id, product.id);
        }),
      ).rejects.toThrow();
    });
  });
});

describe("campaign_sellers uniqueness", () => {
  it("rejects a duplicate (campaign, seller) pair", async () => {
    await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      await tx.insert(campaignSellers).values({ campaignId: campaign.id, sellerId: seller.id });

      await expect(
        tx.transaction(async (tx2) => {
          await tx2
            .insert(campaignSellers)
            .values({ campaignId: campaign.id, sellerId: seller.id });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("non-negative/positive monetary CHECK constraints", () => {
  it("rejects a negative order total", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);

      await expect(
        tx.transaction(async (tx2) => {
          await createOrder(tx2, campaign.id, { totalAmount: -100 });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a negative campaign_products unit price", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2
            .insert(campaignProducts)
            .values({ campaignId: campaign.id, productId: product.id, unitPriceAmount: -1800 });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a zero seller_settlements amount (must be > 0)", async () => {
    await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2
            .insert(sellerSettlements)
            .values({ campaignId: campaign.id, sellerId: seller.id, amount: 0 });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("order_items quantity CHECK constraint", () => {
  it("rejects a zero quantity", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "PRODUCT",
            productId: product.id,
            nameSnapshot: product.name,
            unitPriceAmount: 1800,
            quantity: 0,
            lineTotalAmount: 0,
          });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a negative quantity", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "PRODUCT",
            productId: product.id,
            nameSnapshot: product.name,
            unitPriceAmount: 1800,
            quantity: -1,
            lineTotalAmount: -1800,
          });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("order_items PRODUCT/BUNDLE reference-consistency CHECK", () => {
  it("rejects a PRODUCT item with no productId", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "PRODUCT",
            nameSnapshot: "Chasselas",
            unitPriceAmount: 1800,
            quantity: 1,
            lineTotalAmount: 1800,
          });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a PRODUCT item that also sets bundleId", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);
      const bundle = await createBundle(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "PRODUCT",
            productId: product.id,
            bundleId: bundle.id,
            nameSnapshot: product.name,
            unitPriceAmount: 1800,
            quantity: 1,
            lineTotalAmount: 1800,
          });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a BUNDLE item with no bundleId", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "BUNDLE",
            nameSnapshot: "Carton découverte",
            unitPriceAmount: 12_000,
            quantity: 1,
            lineTotalAmount: 12_000,
          });
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects a BUNDLE item that also sets productId", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);
      const bundle = await createBundle(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(orderItems).values({
            orderId: order.id,
            itemType: "BUNDLE",
            bundleId: bundle.id,
            productId: product.id,
            nameSnapshot: bundle.name,
            unitPriceAmount: 12_000,
            quantity: 1,
            lineTotalAmount: 12_000,
          });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("seller_settlement_orders.order_id uniqueness", () => {
  it("rejects the same order in two settlement rows", async () => {
    await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id, { sellerId: seller.id });
      const [settlementA] = await tx
        .insert(sellerSettlements)
        .values({ campaignId: campaign.id, sellerId: seller.id, amount: 1800 })
        .returning();
      const [settlementB] = await tx
        .insert(sellerSettlements)
        .values({ campaignId: campaign.id, sellerId: seller.id, amount: 1800 })
        .returning();
      if (!settlementA || !settlementB) throw new Error("fixture insert failed");

      await tx.insert(sellerSettlementOrders).values({
        sellerSettlementId: settlementA.id,
        orderId: order.id,
        amount: 1800,
      });

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.insert(sellerSettlementOrders).values({
            sellerSettlementId: settlementB.id,
            orderId: order.id,
            amount: 1800,
          });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("payment_events (provider, provider_event_id) uniqueness", () => {
  it("rejects a duplicate provider event id from the same provider", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);
      const [payment] = await tx
        .insert(payments)
        .values({ orderId: order.id, method: "TWINT", provider: "WORLDLINE", amount: 1800 })
        .returning();
      if (!payment) throw new Error("fixture insert failed");

      const providerEventId = unique("evt");
      await tx
        .insert(paymentEvents)
        .values({ paymentId: payment.id, provider: "WORLDLINE", providerEventId });

      await expect(
        tx.transaction(async (tx2) => {
          await tx2
            .insert(paymentEvents)
            .values({ paymentId: payment.id, provider: "WORLDLINE", providerEventId });
        }),
      ).rejects.toThrow();
    });
  });
});

describe("RESTRICT protects historical/financial/audit data from deletion", () => {
  it("rejects deleting an Order that has an OrderItem", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id);
      await tx.insert(orderItems).values({
        orderId: order.id,
        itemType: "PRODUCT",
        productId: product.id,
        nameSnapshot: product.name,
        unitPriceAmount: 1800,
        quantity: 1,
        lineTotalAmount: 1800,
      });

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.delete(orders).where(eq(orders.id, order.id));
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects deleting a Product referenced by a CampaignProduct", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      await createCampaignProduct(tx, campaign.id, product.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.delete(products).where(eq(products.id, product.id));
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects deleting a Seller referenced by an Order", async () => {
    await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      await createOrder(tx, campaign.id, { sellerId: seller.id });

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.delete(sellers).where(eq(sellers.id, seller.id));
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects deleting a Campaign referenced by an Order", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      await createOrder(tx, campaign.id);

      await expect(
        tx.transaction(async (tx2) => {
          await tx2.delete(campaigns).where(eq(campaigns.id, campaign.id));
        }),
      ).rejects.toThrow();
    });
  });
});

describe("valid representative records", () => {
  it("inserts a full realistic chain across every table without error", async () => {
    await withRollback(async (tx) => {
      const { campaign, product, seller } = await createBaseFixtures(tx);
      await createCampaignProduct(tx, campaign.id, product.id);

      const bundle = await createBundle(tx, campaign.id);
      await tx
        .insert(bundleItems)
        .values({ bundleId: bundle.id, productId: product.id, quantity: 1 });

      await tx
        .insert(campaignSellers)
        .values({ campaignId: campaign.id, sellerId: seller.id, targetAmount: 100_000 });

      const order = await createOrder(tx, campaign.id, { sellerId: seller.id, source: "MANUAL" });

      const [productItem] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          itemType: "PRODUCT",
          productId: product.id,
          nameSnapshot: product.name,
          unitPriceAmount: 1800,
          quantity: 2,
          lineTotalAmount: 3600,
        })
        .returning();

      const [bundleItem] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          itemType: "BUNDLE",
          bundleId: bundle.id,
          nameSnapshot: bundle.name,
          unitPriceAmount: 12_000,
          quantity: 1,
          lineTotalAmount: 12_000,
        })
        .returning();
      if (!productItem || !bundleItem) throw new Error("fixture insert failed");

      await tx.insert(orderBundleComponents).values({
        orderItemId: bundleItem.id,
        productId: product.id,
        productNameSnapshot: product.name,
        quantityPerBundle: 1,
      });

      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          method: "SELLER",
          provider: "OFFLINE",
          amount: 15_600,
          status: "SUCCEEDED",
        })
        .returning();
      if (!payment) throw new Error("fixture insert failed");

      await tx.insert(paymentEvents).values({
        paymentId: payment.id,
        provider: "OFFLINE",
        providerEventId: unique("evt"),
        eventType: "manual_confirmation",
      });

      const [settlement] = await tx
        .insert(sellerSettlements)
        .values({ campaignId: campaign.id, sellerId: seller.id, amount: 15_600 })
        .returning();
      if (!settlement) throw new Error("fixture insert failed");

      await tx.insert(sellerSettlementOrders).values({
        sellerSettlementId: settlement.id,
        orderId: order.id,
        amount: 15_600,
      });

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      expect(items).toHaveLength(2);
    });
  });
});
