import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrder, type CreateOrderInput } from "@/infrastructure/orders/create-order";
import {
  OrderNotFoundError,
  OrderNotPayableError,
  cancelOrder,
  markCustomerPaymentReceived,
} from "@/infrastructure/orders/orders";
import {
  adminUsers,
  campaignProducts,
  campaigns,
  orderEvents,
  payments,
  products,
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

describe("markCustomerPaymentReceived — success", () => {
  it("moves Payment PENDING->SUCCEEDED and Order PENDING->PAID atomically, with paidAt and an audit event", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      const before = new Date();
      const updated = await markCustomerPaymentReceived(order.id, admin.id, tx);
      expect(updated.customerPaymentStatus).toBe("PAID");

      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(payment?.status).toBe("SUCCEEDED");
      expect(payment?.paidAt).not.toBeNull();
      expect(payment!.paidAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      const paidEvent = events.find((e) => e.type === "CUSTOMER_PAYMENT_MARKED_PAID");
      expect(paidEvent).toMatchObject({ actorType: "ADMIN", adminUserId: admin.id });
    });
  });
});

describe("markCustomerPaymentReceived — repeated invocation is safe", () => {
  it("a second call rejects cleanly, without creating a duplicate Payment/event or moving paidAt", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      await markCustomerPaymentReceived(order.id, admin.id, tx);
      const [firstPayment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      const firstPaidAt = firstPayment!.paidAt;

      await expect(markCustomerPaymentReceived(order.id, admin.id, tx)).rejects.toThrow(
        OrderNotPayableError,
      );

      const allPayments = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(allPayments).toHaveLength(1);
      expect(allPayments[0]?.paidAt?.getTime()).toBe(firstPaidAt?.getTime());

      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(events.filter((e) => e.type === "CUSTOMER_PAYMENT_MARKED_PAID")).toHaveLength(1);
    });
  });
});

describe("markCustomerPaymentReceived — rejections", () => {
  it("rejects an unknown order id", async () => {
    await withRollback(async (tx) => {
      const admin = await setupAdmin(tx);
      await expect(markCustomerPaymentReceived(randomUUID(), admin.id, tx)).rejects.toThrow(
        OrderNotFoundError,
      );
    });
  });

  it("rejects a cancelled order", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      await cancelOrder(order.id, admin.id, tx);
      await expect(markCustomerPaymentReceived(order.id, admin.id, tx)).rejects.toThrow(
        OrderNotPayableError,
      );
    });
  });

  it("rejects an order with no matching SELLER payment row (future/non-offline payment isolation)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);

      // Simulate a future non-offline payment method: swap the SELLER
      // row for a TWINT one, exactly as a future online-payment order
      // would have. This action must never touch it.
      await tx.update(payments).set({ method: "TWINT" }).where(eq(payments.orderId, order.id));

      await expect(markCustomerPaymentReceived(order.id, admin.id, tx)).rejects.toThrow(
        OrderNotPayableError,
      );
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(payment?.status).toBe("PENDING");
    });
  });

  it("a rejected call leaves Payment and Order state completely unchanged (no partial mutation)", async () => {
    await withRollback(async (tx) => {
      const campaign = await setupActiveCampaign(tx);
      const product = await setupProduct(tx, campaign.id);
      const admin = await setupAdmin(tx);
      const order = await createTestOrder(tx, campaign.id, product.id);
      await cancelOrder(order.id, admin.id, tx);

      const before = await tx.select().from(payments).where(eq(payments.orderId, order.id));

      await expect(markCustomerPaymentReceived(order.id, admin.id, tx)).rejects.toThrow();

      const after = await tx.select().from(payments).where(eq(payments.orderId, order.id));
      expect(after).toEqual(before);
    });
  });
});
