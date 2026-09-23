import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import { markCustomerPaymentReceived } from "@/infrastructure/orders/orders";
import { createSettlement } from "@/infrastructure/settlements/settlements";
import {
  adminUsers,
  campaignProducts,
  campaignSellers,
  campaigns,
  orderBundleComponents,
  orderEvents,
  orderItems,
  orders,
  payments,
  products,
  sellerSettlementOrders,
  sellerSettlements,
  sellers,
} from "../schema";
import { unique } from "./fixtures";
import { db } from "./setup";

// Gate 11B: this file uses real committed `db`, so `createOrder()`'s
// automatic SELLER-payment email dispatch would otherwise attempt a
// real Resend call using whatever credentials are in .env.local —
// mocked so this suite can never send real email. `importOriginal`
// preserves the real Email*Error classes that order-confirmation.ts's
// classifyEmailFailure() does `instanceof` checks against.
vi.mock("@/infrastructure/email/resend-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/email/resend-provider")>();
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue({ messageId: "test-mocked-message-id" }),
  };
});

/**
 * Real COMMITTED transactions on purpose (not `withRollback`) — proves
 * the `seller_settlement_orders_order_id_unique` backstop genuinely
 * serializes two concurrent settlement attempts racing for the same
 * order, exactly like `create-order-concurrency.db.test.ts` proves the
 * equivalent for order creation. Uses the real seeded ACTIVE campaign
 * without touching its status — only ADDS temporary product/seller/
 * admin rows, removed in `afterEach` alongside everything this file
 * creates.
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
    .values({ slug: unique("settlement-wine"), name: unique("Settlement Wine"), category: "WHITE" })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  await db.insert(campaignProducts).values({ campaignId, productId: product.id, unitPriceAmount });
  return product;
}

async function addTemporarySeller(campaignId: string) {
  const [seller] = await db
    .insert(sellers)
    .values({ firstName: "Concurrency", lastName: unique("Seller") })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  await db.insert(campaignSellers).values({ campaignId, sellerId: seller.id });
  return seller;
}

async function addTemporaryAdmin() {
  const [admin] = await db
    .insert(adminUsers)
    .values({ email: `${unique("settlement-admin")}@example.test`, name: "Concurrency Admin" })
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

const createdOrderIds: string[] = [];
const createdProductIds: string[] = [];
const createdSellerIds: string[] = [];
const createdAdminIds: string[] = [];
const createdSettlementIds: string[] = [];

afterEach(async () => {
  const settlementIds = createdSettlementIds.splice(0);
  if (settlementIds.length > 0) {
    await db
      .delete(sellerSettlementOrders)
      .where(inArray(sellerSettlementOrders.sellerSettlementId, settlementIds));
    await db.delete(sellerSettlements).where(inArray(sellerSettlements.id, settlementIds));
  }

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

  const sellerIds = createdSellerIds.splice(0);
  if (sellerIds.length > 0) {
    await db.delete(campaignSellers).where(inArray(campaignSellers.sellerId, sellerIds));
    await db.delete(sellers).where(inArray(sellers.id, sellerIds));
  }

  const productIds = createdProductIds.splice(0);
  if (productIds.length > 0) {
    await db.delete(campaignProducts).where(inArray(campaignProducts.productId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
  }

  const adminIds = createdAdminIds.splice(0);
  if (adminIds.length > 0) {
    await db.delete(adminUsers).where(inArray(adminUsers.id, adminIds));
  }
});

describe("createSettlement concurrency", () => {
  it("two concurrent settlement attempts racing for the SAME order: exactly one succeeds, the order belongs to exactly one settlement", async () => {
    const campaign = await getRealActiveCampaign();
    const product = await addTemporaryProduct(campaign.id);
    createdProductIds.push(product.id);
    const seller = await addTemporarySeller(campaign.id);
    createdSellerIds.push(seller.id);
    const admin = await addTemporaryAdmin();
    createdAdminIds.push(admin.id);

    const orderResult = await createOrder(
      customerInput({
        items: [{ type: "PRODUCT", id: product.id, quantity: 1 }],
        sellerId: seller.id,
      }),
      { type: "SYSTEM" },
      "ONLINE",
    );
    if (orderResult.status !== "created") throw new Error("fixture order creation failed");
    createdOrderIds.push(orderResult.order.id);
    await markCustomerPaymentReceived(orderResult.order.id, admin.id);

    const attempt = () =>
      createSettlement({
        campaignId: campaign.id,
        sellerId: seller.id,
        orderIds: [orderResult.order.id],
        adminId: admin.id,
      });

    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof attempt>>> =>
        r.status === "fulfilled",
    );
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The rejected attempt must surface a clean domain error, never a raw SQL constraint message.
    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(Error);
    expect((rejectedReason as Error).message).not.toMatch(/duplicate key|constraint|SQL/i);

    createdSettlementIds.push(fulfilled[0]!.value.id);

    const links = await db
      .select()
      .from(sellerSettlementOrders)
      .where(eq(sellerSettlementOrders.orderId, orderResult.order.id));
    expect(links).toHaveLength(1);
    expect(links[0]?.sellerSettlementId).toBe(fulfilled[0]!.value.id);

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderResult.order.id));
    expect(finalOrder?.sellerSettlementStatus).toBe("SETTLED");
  });
});
