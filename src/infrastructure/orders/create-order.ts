import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getPublicCatalog } from "../catalog/get-public-catalog";
import { db } from "../database/client";
import {
  campaigns,
  orderBundleComponents,
  orderEvents,
  orderItems,
  orders,
  payments,
} from "../database/schema";
import { reserveOrderNumber } from "../database/order-number-counter";
import { listActiveCampaignSellers } from "../campaign/campaign-sellers";
import { calculateOrderTotal } from "@/domain/orders/calculate-order-total";
import { resolveOrderLines, type OrderLineRequest } from "@/domain/orders/resolve-order-lines";
import { resolveOrderNumberYear } from "@/domain/orders/resolve-order-number-year";
import type { CustomerInfoInput } from "@/domain/orders/order-input-schema";

export interface CreateOrderInput extends CustomerInfoInput {
  items: OrderLineRequest[];
  /** The cart's own stored campaign id (Phase 6) — omit for MANUAL, which has no client-side cart snapshot to go stale. */
  campaignId?: string;
  sellerId: string | null;
  idempotencyKey: string;
}

export type OrderCreationActor = { type: "SYSTEM" } | { type: "ADMIN"; adminUserId: string };

type OrderRecord = typeof orders.$inferSelect;
type OrderItemRecord = typeof orderItems.$inferSelect;

export type CreateOrderRejectReason =
  | "empty-cart"
  | "no-active-campaign"
  | "stale-campaign"
  | { reason: "unavailable-items"; unavailable: OrderLineRequest[] }
  | "invalid-seller";

export type CreateOrderResult =
  | { status: "created"; order: OrderRecord; items: OrderItemRecord[] }
  | { status: "existing"; order: OrderRecord; items: OrderItemRecord[] }
  | { status: "rejected"; reason: CreateOrderRejectReason };

type DbHandle = Pick<typeof db, "transaction">;

async function fetchOrderWithItems(
  tx: Pick<typeof db, "select">,
  orderId: string,
): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  if (!order) {
    throw new Error(`fetchOrderWithItems: order ${orderId} not found immediately after insert.`);
  }
  return { order, items };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505" &&
    "constraint" in error &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}

/**
 * The ONE authoritative order-creation pipeline (Phase 7,
 * docs/05-ARCHITECTURE.md §20, docs/10 §48 "SAME order-creation core"
 * for ONLINE and MANUAL alike). Every browser/admin-submitted price,
 * name, availability, and seller eligibility claim is discarded and
 * re-resolved from live server-side data inside one transaction —
 * nothing here ever trusts `input` beyond identities/quantities/text
 * fields (BR-CART-002, BR-SEC-001).
 *
 * Idempotency (Phase 7 §5/§6): `input.idempotencyKey` is a caller-
 * generated token for one logical creation attempt. A Postgres advisory
 * transaction lock keyed on that token (`pg_advisory_xact_lock`,
 * auto-released at commit/rollback) serializes concurrent callers
 * sharing the same key, so the normal case — sequential retry OR a
 * genuine race — resolves without ever double-reserving an order
 * number: the second caller blocks until the first commits, then finds
 * the row via the plain `idempotencyKey` lookup below and returns it
 * without writing anything. The lock is a gap-avoidance optimization,
 * NOT the correctness boundary — `orders_idempotency_key_unique` is:
 * if the same key is ever submitted through a path that bypasses the
 * lock (or in the astronomically unlikely event of a `hashtext` hash
 * collision serializing two *different* keys onto one lock), the
 * unique constraint still makes a true duplicate impossible, and the
 * nested-savepoint catch below recovers cleanly by returning the
 * winner's row instead of surfacing a confusing constraint error.
 */
export async function createOrder(
  input: CreateOrderInput,
  actor: OrderCreationActor,
  source: "ONLINE" | "MANUAL",
  dbHandle: DbHandle = db,
): Promise<CreateOrderResult> {
  return dbHandle.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);

    const [alreadyCreated] = await tx
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));
    if (alreadyCreated) {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, alreadyCreated.id));
      return { status: "existing", order: alreadyCreated, items };
    }

    const catalog = await getPublicCatalog(tx);
    if (catalog.state !== "active") {
      return { status: "rejected", reason: "no-active-campaign" };
    }
    if (input.campaignId && input.campaignId !== catalog.campaign.id) {
      return { status: "rejected", reason: "stale-campaign" };
    }

    const resolved = resolveOrderLines(input.items, catalog);
    if (!resolved.ok) {
      if (resolved.reason === "unavailable-items") {
        return {
          status: "rejected",
          reason: { reason: "unavailable-items", unavailable: resolved.unavailable },
        };
      }
      return { status: "rejected", reason: resolved.reason };
    }

    if (input.sellerId) {
      const eligibleSellers = await listActiveCampaignSellers(catalog.campaign.id, tx);
      if (!eligibleSellers.some((seller) => seller.id === input.sellerId)) {
        return { status: "rejected", reason: "invalid-seller" };
      }
    }

    const { total } = calculateOrderTotal(
      resolved.lines.map((line) => ({ unitPriceAmount: line.unitPrice, quantity: line.quantity })),
    );

    // `PublicCatalog`'s campaign shape is deliberately narrow (public
    // read model — see domain/catalog/public-catalog.ts) and doesn't
    // carry `openingDate`; fetch just that one admin-only field, same
    // transaction/snapshot.
    const [campaignDates] = await tx
      .select({ openingDate: campaigns.openingDate })
      .from(campaigns)
      .where(eq(campaigns.id, catalog.campaign.id));
    const year = resolveOrderNumberYear({ openingDate: campaignDates?.openingDate ?? null });
    const orderNumber = await reserveOrderNumber(tx, year);

    const now = new Date();

    let insertedOrder: OrderRecord;
    try {
      insertedOrder = await tx.transaction(async (savepoint) => {
        const [created] = await savepoint
          .insert(orders)
          .values({
            orderNumber,
            idempotencyKey: input.idempotencyKey,
            campaignId: catalog.campaign.id,
            source,
            customerFirstName: input.customerFirstName,
            customerLastName: input.customerLastName,
            customerAddress: input.customerAddress,
            customerPostalCode: input.customerPostalCode,
            customerCity: input.customerCity,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            deliveryNote: input.deliveryNote || null,
            sellerId: input.sellerId,
            currency: "CHF",
            subtotalAmount: total,
            totalAmount: total,
            status: "CONFIRMED",
            customerPaymentStatus: "PENDING",
            sellerSettlementStatus: "PENDING",
            confirmedAt: now,
          })
          .returning();
        if (!created) {
          throw new Error("createOrder: order insert returned no row.");
        }
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error, "orders_idempotency_key_unique")) {
        const { order, items } = await fetchOrderWithItems(
          tx,
          (
            await tx
              .select({ id: orders.id })
              .from(orders)
              .where(eq(orders.idempotencyKey, input.idempotencyKey))
          )[0]!.id,
        );
        return { status: "existing", order, items };
      }
      throw error;
    }

    const insertedItems: OrderItemRecord[] = [];
    for (const line of resolved.lines) {
      const [item] = await tx
        .insert(orderItems)
        .values({
          orderId: insertedOrder.id,
          itemType: line.type,
          productId: line.productId,
          bundleId: line.bundleId,
          nameSnapshot: line.name,
          unitPriceAmount: line.unitPrice,
          quantity: line.quantity,
          lineTotalAmount: line.lineTotal,
        })
        .returning();
      if (!item) {
        throw new Error("createOrder: order item insert returned no row.");
      }
      insertedItems.push(item);

      if (line.bundleComponents) {
        for (const component of line.bundleComponents) {
          await tx.insert(orderBundleComponents).values({
            orderItemId: item.id,
            productId: component.productId,
            productNameSnapshot: component.productName,
            quantityPerBundle: component.quantityPerBundle,
          });
        }
      }
    }

    await tx.insert(payments).values({
      orderId: insertedOrder.id,
      method: "SELLER",
      provider: "OFFLINE",
      amount: total,
      currency: "CHF",
      status: "PENDING",
    });

    await tx.insert(orderEvents).values({
      orderId: insertedOrder.id,
      type: "ORDER_CREATED",
      actorType: actor.type,
      adminUserId: actor.type === "ADMIN" ? actor.adminUserId : null,
      metadata: { source },
    });

    return { status: "created", order: insertedOrder, items: insertedItems };
  });
}
