import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  campaignProducts,
  campaigns,
  orderBundleComponents,
  orderEvents,
  orderItems,
  orders,
  payments,
  products,
} from "../schema";
import { unique } from "./fixtures";
import { db } from "./setup";

/**
 * Real COMMITTED transactions on purpose (not `withRollback`), exactly
 * like `order-number-counter.db.test.ts`'s own concurrency suite —
 * proving the `pg_advisory_xact_lock` + unique-constraint idempotency
 * design under GENUINE concurrent connections requires transactions
 * that actually commit; `withRollback`'s single wrapping transaction
 * cannot exercise cross-connection concurrency at all (everything in it
 * runs serially on one connection/session).
 *
 * Uses the real seeded ACTIVE campaign rather than touching its status
 * (never flips DRAFT/ACTIVE — that invariant is exercised elsewhere) —
 * only ADDS a temporary product/campaignProduct pair, removed in
 * `afterEach` alongside every order this file creates.
 */

async function getRealActiveCampaign() {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
  if (!campaign) {
    throw new Error(
      "This suite requires a seeded ACTIVE campaign (run `pnpm db:seed` if the local DB is empty).",
    );
  }
  return campaign;
}

async function addTemporaryProduct(campaignId: string, unitPriceAmount = 1_800) {
  const [product] = await db
    .insert(products)
    .values({
      slug: unique("concurrency-wine"),
      name: unique("Concurrency Wine"),
      category: "WHITE",
    })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await db.insert(campaignProducts).values({ campaignId, productId: product.id, unitPriceAmount });
  return product;
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

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];

afterEach(async () => {
  const orderIds = createdOrderIds.splice(0);
  if (orderIds.length > 0) {
    const items = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    const itemIds = items.map((item) => item.id);
    if (itemIds.length > 0) {
      await db
        .delete(orderBundleComponents)
        .where(inArray(orderBundleComponents.orderItemId, itemIds));
    }
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    await db.delete(payments).where(inArray(payments.orderId, orderIds));
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }

  const productIds = createdProductIds.splice(0);
  if (productIds.length > 0) {
    await db.delete(campaignProducts).where(inArray(campaignProducts.productId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
  }
});

describe("createOrder concurrency", () => {
  it("the SAME idempotency key submitted concurrently results in exactly ONE order, both callers agreeing on its identity", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const key = randomUUID();

    const [resultA, resultB] = await Promise.all([
      createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          idempotencyKey: key,
        }),
        { type: "SYSTEM" },
        "ONLINE",
      ),
      createOrder(
        customerInput({
          items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
          idempotencyKey: key,
        }),
        { type: "SYSTEM" },
        "ONLINE",
      ),
    ]);

    const orderIds = new Set(
      [resultA, resultB]
        .filter((r) => r.status === "created" || r.status === "existing")
        .map((r) => (r.status === "created" || r.status === "existing" ? r.order.id : null)),
    );
    for (const id of orderIds) {
      if (id) createdOrderIds.push(id);
    }

    // Exactly one distinct order identity between the two callers.
    expect(orderIds.size).toBe(1);
    // Exactly one is "created", the other "existing" (order doesn't matter — the lock decides who wins).
    const statuses = [resultA.status, resultB.status].sort();
    expect(statuses).toEqual(["created", "existing"]);

    const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, key));
    expect(rows).toHaveLength(1);
  });

  it("different concurrent submissions (different keys) each succeed with unique order numbers", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);

    const [resultA, resultB, resultC] = await Promise.all([
      createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
      ),
      createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
      ),
      createOrder(
        customerInput({ items: [{ type: "PRODUCT", id: product.id, quantity: 1 }] }),
        { type: "SYSTEM" },
        "ONLINE",
      ),
    ]);

    for (const result of [resultA, resultB, resultC]) {
      expect(result.status).toBe("created");
      if (result.status === "created") createdOrderIds.push(result.order.id);
    }

    const orderNumbers = [resultA, resultB, resultC].map((r) =>
      r.status === "created" ? r.order.orderNumber : null,
    );
    expect(new Set(orderNumbers).size).toBe(3);
  });
});
