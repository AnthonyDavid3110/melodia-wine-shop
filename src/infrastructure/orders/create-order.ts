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
  sellers,
} from "../database/schema";
import { reserveOrderNumber } from "../database/order-number-counter";
import { listActiveCampaignSellers } from "../campaign/campaign-sellers";
import { calculateOrderTotal } from "@/domain/orders/calculate-order-total";
import { resolveOrderLines, type OrderLineRequest } from "@/domain/orders/resolve-order-lines";
import { resolveOrderNumberYear } from "@/domain/orders/resolve-order-number-year";
import type { CustomerInfoInput } from "@/domain/orders/order-input-schema";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { dispatchOrderConfirmationEmail } from "@/infrastructure/email/order-confirmation";
import type { OrderConfirmationEmailInput } from "@/domain/email/order-confirmation-content";

export interface CreateOrderInput extends CustomerInfoInput {
  items: OrderLineRequest[];
  /** The cart's own stored campaign id (Phase 6) — omit for MANUAL, which has no client-side cart snapshot to go stale. */
  campaignId?: string;
  sellerId: string | null;
  idempotencyKey: string;
  /**
   * Phase 10 Gate 10B. `SELLER` (default) preserves the exact Phase 7
   * behaviour byte-for-byte — MANUAL entry never sets this. `TWINT`/
   * `CARD` create the Order alone, in `NEW` status, with no Payment row
   * at all: the first online Payment attempt is created separately by
   * `initiateOnlinePayment()` right after, since starting a Saferpay
   * session is an external HTTP call that must never happen inside this
   * function's database transaction (docs/05-ARCHITECTURE.md §21 vs.
   * Gate 10B §10's external-call transaction-boundary requirement).
   */
  paymentMethod?: "SELLER" | "TWINT" | "CARD";
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

type DbHandle = Pick<typeof db, "transaction" | "select" | "insert">;

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

/**
 * Gate 11B — assembles the SELLER-variant confirmation email content
 * from the just-created (already-committed) order/items, resolving the
 * seller's display name where assigned (never fabricated when
 * unassigned — docs/03-USER-FLOWS.md §17).
 */
async function buildSellerConfirmationEmailInput(
  dbHandle: Pick<typeof db, "select">,
  order: OrderRecord,
  items: OrderItemRecord[],
): Promise<OrderConfirmationEmailInput> {
  let sellerName: string | null = null;
  if (order.sellerId) {
    const [seller] = await dbHandle.select().from(sellers).where(eq(sellers.id, order.sellerId));
    if (seller) {
      sellerName = formatSellerName(seller);
    }
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      customerAddress: order.customerAddress,
      customerPostalCode: order.customerPostalCode,
      customerCity: order.customerCity,
      deliveryNote: order.deliveryNote,
      totalAmount: order.totalAmount,
    },
    items: items.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
    })),
    paymentMethod: "SELLER",
    sellerName,
  };
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
  const result: CreateOrderResult = await dbHandle.transaction(async (tx) => {
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
    const paymentMethod = input.paymentMethod ?? "SELLER";
    const isOnline = paymentMethod === "TWINT" || paymentMethod === "CARD";

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
            // Gate 10B §4 approved semantics: an online order starts NEW,
            // with sellerSettlementStatus NOT_APPLICABLE, and no
            // confirmedAt — CONFIRMED/confirmedAt only happen at the
            // trusted provider-success transaction (never here).
            status: isOnline ? "NEW" : "CONFIRMED",
            customerPaymentStatus: "PENDING",
            sellerSettlementStatus: isOnline ? "NOT_APPLICABLE" : "PENDING",
            confirmedAt: isOnline ? null : now,
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

    // Online orders get no Payment row here — the first attempt is
    // created by `initiateOnlinePayment()`, outside this transaction,
    // once the Saferpay session actually exists (see the paymentMethod
    // doc comment on CreateOrderInput above).
    if (!isOnline) {
      await tx.insert(payments).values({
        orderId: insertedOrder.id,
        method: "SELLER",
        provider: "OFFLINE",
        amount: total,
        currency: "CHF",
        status: "PENDING",
      });
    }

    await tx.insert(orderEvents).values({
      orderId: insertedOrder.id,
      type: "ORDER_CREATED",
      actorType: actor.type,
      adminUserId: actor.type === "ADMIN" ? actor.adminUserId : null,
      metadata: { source },
    });

    return { status: "created", order: insertedOrder, items: insertedItems };
  });

  // Gate 11B — automatic confirmation email, public checkout + SELLER
  // payment only (never MANUAL admin entry — `source === "ONLINE"` is
  // the smallest, already-existing, reliable distinction the schema
  // provides; no migration needed). `result.order.status === "CONFIRMED"`
  // further excludes an ONLINE order that chose TWINT/CARD (status
  // `NEW` here — that gets its confirmation later, from
  // `applySuccessfulOnlinePayment()`, once payment is actually
  // authoritatively confirmed).
  //
  // `dbHandle === db`: external post-commit side effects (the Resend
  // HTTP call) may only run when this function owns the durable
  // top-level DB handle. A `dbHandle` passed in by a caller (e.g. a
  // test's own transaction/savepoint) may still be rolled back by that
  // caller after this function returns — the "commit" `dbHandle.
  // transaction(...)` just resolved from would then never have
  // genuinely happened, and dispatching email off the back of it would
  // be observing a transition that, from the database's perspective,
  // never occurred.
  if (
    result.status === "created" &&
    source === "ONLINE" &&
    result.order.status === "CONFIRMED" &&
    dbHandle === db
  ) {
    try {
      const emailInput = await buildSellerConfirmationEmailInput(
        dbHandle,
        result.order,
        result.items,
      );
      await dispatchOrderConfirmationEmail(dbHandle, result.order.id, emailInput);
    } catch {
      // Never let a failure here (seller lookup, send, or event
      // recording) escape into the caller — the order itself already
      // committed successfully and must be returned as such regardless
      // (docs/05-ARCHITECTURE.md §30).
    }
  }

  return result;
}
