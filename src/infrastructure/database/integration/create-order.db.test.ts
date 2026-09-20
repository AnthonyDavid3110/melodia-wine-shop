import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { parseOrderNumber } from "@/domain/order-number";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import { reserveOrderNumber } from "../order-number-counter";
import {
  adminUsers,
  bundleItems,
  bundles,
  campaignProducts,
  campaignSellers,
  campaigns,
  orderBundleComponents,
  orderEvents,
  orderItems,
  orderNumberCounters,
  orders,
  payments,
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
    .values({
      name: unique("Campaign"),
      slug: unique("campaign"),
      status: "ACTIVE",
      openingDate: new Date("2026-09-01T00:00:00Z"),
      ...overrides,
    })
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
  const [campaignProduct] = await tx
    .insert(campaignProducts)
    .values({ campaignId, productId: product.id, unitPriceAmount, active: true })
    .returning();
  if (!campaignProduct) throw new Error("fixture insert failed");
  return { product, campaignProduct };
}

async function setupBundle(
  tx: Tx,
  campaignId: string,
  componentProductId: string,
  priceAmount = 10_000,
  quantityPerBundle = 1,
) {
  const [bundle] = await tx
    .insert(bundles)
    .values({
      campaignId,
      name: unique("Bundle"),
      slug: unique("bundle"),
      priceAmount,
      active: true,
    })
    .returning();
  if (!bundle) throw new Error("fixture insert failed");
  await tx
    .insert(bundleItems)
    .values({ bundleId: bundle.id, productId: componentProductId, quantity: quantityPerBundle });
  return bundle;
}

async function setupSeller(tx: Tx, campaignId: string) {
  const [seller] = await tx
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique("Seller"), active: true })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  const [campaignSeller] = await tx
    .insert(campaignSellers)
    .values({ campaignId, sellerId: seller.id, active: true })
    .returning();
  if (!campaignSeller) throw new Error("fixture insert failed");
  return { seller, campaignSeller };
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

describe("createOrder — successful creation", () => {
  it("creates a public seller-payment order with a seller assigned", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product, campaignProduct } = await setupProduct(tx, campaign.id, 1_800);
      const { seller } = await setupSeller(tx, campaign.id);

      const result = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 2 }],
          sellerId: seller.id,
          campaignId: campaign.id,
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );

      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      expect(result.order.source).toBe("ONLINE");
      expect(result.order.sellerId).toBe(seller.id);
      expect(result.order.campaignId).toBe(campaign.id);
      expect(result.order.subtotalAmount).toBe(campaignProduct.unitPriceAmount * 2);
      expect(result.order.totalAmount).toBe(campaignProduct.unitPriceAmount * 2);
      expect(parseOrderNumber(result.order.orderNumber)?.year).toBe(2026);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        itemType: "PRODUCT",
        productId: product.id,
        nameSnapshot: product.name,
        unitPriceAmount: 1_800,
        quantity: 2,
        lineTotalAmount: 3_600,
      });
    });
  });

  it("creates a valid unassigned seller-payment order (sellerId null)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const result = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          sellerId: null,
          campaignId: campaign.id,
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );

      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      expect(result.order.sellerId).toBeNull();
    });
  });

  it("uses the CURRENT authoritative price, never anything the caller might imply", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id, 1_800);

      const first = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(first.status).toBe("created");
      if (first.status !== "created") throw new Error("unreachable");
      expect(first.items[0]?.unitPriceAmount).toBe(1_800);

      // Price changes live...
      await tx
        .update(campaignProducts)
        .set({ unitPriceAmount: 2_500 })
        .where(eq(campaignProducts.productId, product.id));

      const second = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(second.status).toBe("created");
      if (second.status !== "created") throw new Error("unreachable");
      expect(second.items[0]?.unitPriceAmount).toBe(2_500);

      // ...but the FIRST order's historical snapshot never changes (BR-PRI-003).
      const [refetchedFirstItem] = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, first.order.id));
      expect(refetchedFirstItem?.unitPriceAmount).toBe(1_800);
    });
  });
});

describe("createOrder — rejections", () => {
  it("rejects an empty cart without writing anything", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const result = await createOrder(
        customerInput({ items: [], campaignId: campaign.id }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toEqual({ status: "rejected", reason: "empty-cart" });
      const rows = await tx.select().from(orders).where(eq(orders.campaignId, campaign.id));
      expect(rows).toHaveLength(0);
    });
  });

  it("rejects a stale/wrong campaign id", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const result = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          campaignId: randomUUID(), // not the real active campaign
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toEqual({ status: "rejected", reason: "stale-campaign" });
    });
  });

  it("rejects a hidden (campaignProduct.active=false) product", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      await tx
        .update(campaignProducts)
        .set({ active: false })
        .where(eq(campaignProducts.productId, product.id));

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toMatchObject({ status: "rejected", reason: { reason: "unavailable-items" } });
    });
  });

  it("rejects a globally inactive product", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      await tx.update(products).set({ active: false }).where(eq(products.id, product.id));

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toMatchObject({ status: "rejected", reason: { reason: "unavailable-items" } });
    });
  });

  it("rejects an invalid bundle (inactive)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const bundle = await setupBundle(tx, campaign.id, product.id);
      await tx.update(bundles).set({ active: false }).where(eq(bundles.id, bundle.id));

      const result = await createOrder(
        customerInput({ items: [{ type: "BUNDLE", id: bundle.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toMatchObject({ status: "rejected", reason: { reason: "unavailable-items" } });
    });
  });

  it("rejects an unknown/invalid seller id", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const result = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          sellerId: randomUUID(),
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toEqual({ status: "rejected", reason: "invalid-seller" });
    });
  });

  it("rejects a seller that became inactive before submission", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const { seller, campaignSeller } = await setupSeller(tx, campaign.id);
      await tx
        .update(campaignSellers)
        .set({ active: false })
        .where(eq(campaignSellers.id, campaignSeller.id));

      const result = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          sellerId: seller.id,
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result).toEqual({ status: "rejected", reason: "invalid-seller" });
    });
  });

  it("a rejection never reserves an order number — validation happens before reservation", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const before = await tx
        .select()
        .from(orderNumberCounters)
        .where(eq(orderNumberCounters.year, 2026));

      await createOrder(
        customerInput({ items: [], campaignId: campaign.id }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );

      const after = await tx
        .select()
        .from(orderNumberCounters)
        .where(eq(orderNumberCounters.year, 2026));
      expect(after).toEqual(before);
    });
  });
});

describe("createOrder — bundle snapshots", () => {
  it("persists OrderBundleComponent rows matching the live composition at order time", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const bundle = await setupBundle(tx, campaign.id, product.id, 10_000, 3);

      const result = await createOrder(
        customerInput({ items: [{ type: "BUNDLE", id: bundle.id, quantity: 2 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");

      const orderItem = result.items[0]!;
      expect(orderItem).toMatchObject({
        itemType: "BUNDLE",
        bundleId: bundle.id,
        quantity: 2,
        unitPriceAmount: 10_000,
        lineTotalAmount: 20_000,
      });

      const components = await tx
        .select()
        .from(orderBundleComponents)
        .where(eq(orderBundleComponents.orderItemId, orderItem.id));
      expect(components).toHaveLength(1);
      // quantityPerBundle is the PER-BUNDLE composition (3), NOT
      // pre-multiplied by the ordered quantity (2) — multiplication
      // happens later, at wine-requirement aggregation time, via
      // decomposeBundle() against this same snapshot.
      expect(components[0]).toMatchObject({
        productId: product.id,
        productNameSnapshot: product.name,
        quantityPerBundle: 3,
      });
    });
  });

  it("historical bundle composition remains unchanged after the live bundle is edited", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const bundle = await setupBundle(tx, campaign.id, product.id, 10_000, 1);

      const result = await createOrder(
        customerInput({ items: [{ type: "BUNDLE", id: bundle.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      const orderItemId = result.items[0]!.id;

      // Live composition changes drastically after the order was placed.
      await tx.update(bundleItems).set({ quantity: 99 }).where(eq(bundleItems.bundleId, bundle.id));

      const components = await tx
        .select()
        .from(orderBundleComponents)
        .where(eq(orderBundleComponents.orderItemId, orderItemId));
      expect(components[0]?.quantityPerBundle).toBe(1);
    });
  });
});

describe("createOrder — Payment and OrderEvent", () => {
  it("creates a PENDING SELLER/OFFLINE Payment for the full order total", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id, 1_800);

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 4 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");

      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.orderId, result.order.id));
      expect(payment).toMatchObject({
        method: "SELLER",
        provider: "OFFLINE",
        status: "PENDING",
        amount: 7_200,
        currency: "CHF",
      });
      expect(payment?.paidAt).toBeNull();
    });
  });

  it("sets the correct initial Order states", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      expect(result.order.status).toBe("CONFIRMED");
      expect(result.order.customerPaymentStatus).toBe("PENDING");
      expect(result.order.sellerSettlementStatus).toBe("PENDING");
      expect(result.order.confirmedAt).not.toBeNull();
    });
  });

  it("writes an ORDER_CREATED event with SYSTEM actor for public checkout", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, result.order.id));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "ORDER_CREATED",
        actorType: "SYSTEM",
        adminUserId: null,
      });
    });
  });

  it("writes an ORDER_CREATED event with ADMIN actor for manual entry", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const [admin] = await tx
        .insert(adminUsers)
        .values({ email: `${unique("admin")}@example.test`, name: "Test Admin" })
        .returning();

      const result = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "ADMIN", adminUserId: admin!.id },
        "MANUAL",
        tx,
      );
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("unreachable");
      expect(result.order.source).toBe("MANUAL");

      const events = await tx
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, result.order.id));
      expect(events[0]).toMatchObject({
        type: "ORDER_CREATED",
        actorType: "ADMIN",
        adminUserId: admin!.id,
      });
    });
  });
});

describe("createOrder — idempotency (sequential replay)", () => {
  it("a second call with the SAME key returns the already-created order, writing nothing new", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);
      const key = randomUUID();

      const first = await createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          idempotencyKey: key,
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(first.status).toBe("created");

      const second = await createOrder(
        // Deliberately different cart contents — proves the replay
        // returns the ORIGINAL order rather than re-validating/re-pricing.
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 99 }],
          idempotencyKey: key,
        }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(second.status).toBe("existing");
      if (first.status !== "created" || second.status !== "existing")
        throw new Error("unreachable");
      expect(second.order.id).toBe(first.order.id);
      expect(second.order.orderNumber).toBe(first.order.orderNumber);

      const allOrders = await tx.select().from(orders).where(eq(orders.idempotencyKey, key));
      expect(allOrders).toHaveLength(1);
    });
  });

  it("a genuinely new order uses a new key and is a distinct order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const { product } = await setupProduct(tx, campaign.id);

      const first = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      const second = await createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
        tx,
      );
      expect(first.status).toBe("created");
      expect(second.status).toBe("created");
      if (first.status !== "created" || second.status !== "created") throw new Error("unreachable");
      expect(first.order.id).not.toBe(second.order.id);
      expect(first.order.orderNumber).not.toBe(second.order.orderNumber);
    });
  });
});

describe("reserveOrderNumber — rollback behavior (Phase 7 §8)", () => {
  it("a reservation made inside a savepoint that later fails does not create a permanent gap", async () => {
    await withRollback(async (tx) => {
      const year = 9500 + Math.floor(Math.random() * 400); // implausible real year, same convention as order-number-counter.db.test.ts
      const first = await reserveOrderNumber(tx, year);
      expect(parseOrderNumber(first)?.sequence).toBe(1);

      await expect(
        tx.transaction(async (savepoint) => {
          const wasted = await reserveOrderNumber(savepoint, year);
          expect(parseOrderNumber(wasted)?.sequence).toBe(2);
          throw new Error("simulated failure after reservation, before commit");
        }),
      ).rejects.toThrow("simulated failure after reservation");

      // The failed attempt's reservation was rolled back with it — the
      // NEXT successful reservation gets sequence 2 back, not 3. Plain
      // transactional table DML (this allocator's whole design,
      // deliberately not a non-transactional SEQUENCE object) rolls
      // back exactly like any other write.
      const next = await reserveOrderNumber(tx, year);
      expect(parseOrderNumber(next)?.sequence).toBe(2);
    });
  });
});
