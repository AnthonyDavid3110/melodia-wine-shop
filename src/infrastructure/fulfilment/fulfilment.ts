import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../database/client";
import {
  orderBundleComponents,
  orderEvents,
  orderItems,
  orders,
  sellers,
} from "../database/schema";
import { OrderNotFoundError } from "../orders/orders";
import {
  canHandOrderToSeller,
  canMarkOrderDelivered,
  canPrepareOrder,
} from "@/domain/orders/order-guards";
import {
  calculateWineRequirements,
  type WineRequirementOrderInput,
} from "@/domain/fulfilment/calculate-wine-requirements";

type DbHandle = Pick<typeof db, "select" | "update" | "insert" | "transaction">;

/**
 * Covers every server-side re-validation failure for a single-order
 * transition (wrong current status, cancelled) with one clean
 * admin-facing message — mirrors `OrderNotCancellableError`'s "don't
 * leak which internal check failed" philosophy (docs/09-SECURITY.md
 * §39). The UI only ever offers the button when the pure guard already
 * agrees, so reaching this in practice means a stale page/race.
 */
export class InvalidFulfilmentTransitionError extends Error {
  constructor() {
    super(
      "Cette commande n'est plus dans un état permettant cette action. Veuillez actualiser la page.",
    );
    this.name = "InvalidFulfilmentTransitionError";
  }
}

/** Distinct from the generic transition error so order detail can explain exactly what's missing (Phase 9 §27). */
export class SellerRequiredForHandoffError extends Error {
  constructor() {
    super("Un vendeur doit d'abord être assigné à cette commande avant de pouvoir la remettre.");
    this.name = "SellerRequiredForHandoffError";
  }
}

export class EmptyFulfilmentSelectionError extends Error {
  constructor() {
    super("Sélectionnez au moins une commande.");
    this.name = "EmptyFulfilmentSelectionError";
  }
}

/**
 * Covers every reason a bulk selection can be rejected (unknown id,
 * wrong campaign, wrong seller, not in the required status) with one
 * message — same rationale as `InvalidSettlementOrderError`. The whole
 * batch is rejected together; there is no partial-success path
 * (Phase 9 §7/§17-19).
 */
export class InvalidBulkFulfilmentSelectionError extends Error {
  constructor() {
    super(
      "Une ou plusieurs commandes sélectionnées ne sont plus éligibles à cette action. Veuillez actualiser la page et réessayer.",
    );
    this.name = "InvalidBulkFulfilmentSelectionError";
  }
}

/**
 * Every non-cancelled order in a campaign, left-joined with its seller
 * (BR-PRE-001: cancelled orders never appear in preparation workflows
 * at all). Backs the "Par vendeur" and "Toutes les commandes" views —
 * a single query, no per-order round trip.
 */
export async function listCampaignFulfilmentOrders(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select({ order: orders, seller: sellers })
    .from(orders)
    .leftJoin(sellers, eq(orders.sellerId, sellers.id))
    .where(and(eq(orders.campaignId, campaignId), ne(orders.status, "CANCELLED")))
    .orderBy(desc(orders.createdAt));
}

interface OrderItemRow {
  id: string;
  orderId: string;
  itemType: string;
  productId: string | null;
  nameSnapshot: string;
  quantity: number;
}

interface BundleComponentRow {
  orderItemId: string;
  productId: string;
  productNameSnapshot: string;
  quantityPerBundle: number;
}

/**
 * Batches OrderItems/OrderBundleComponents for a set of orders in two
 * queries total (never one query per order — Phase 9 §13/§25). Shared
 * by wine-requirement aggregation below; kept private since callers
 * only need the aggregated result, not the raw rows.
 */
async function loadOrderItemsWithBundleComponents(
  orderIds: string[],
  dbHandle: DbHandle,
): Promise<{
  itemsByOrderId: Map<string, OrderItemRow[]>;
  componentsByItemId: Map<string, BundleComponentRow[]>;
}> {
  const itemsByOrderId = new Map<string, OrderItemRow[]>();
  const componentsByItemId = new Map<string, BundleComponentRow[]>();
  if (orderIds.length === 0) {
    return { itemsByOrderId, componentsByItemId };
  }

  const items = await dbHandle
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));
  for (const item of items) {
    const list = itemsByOrderId.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrderId.set(item.orderId, list);
  }

  const itemIds = items.map((item) => item.id);
  if (itemIds.length > 0) {
    const components = await dbHandle
      .select()
      .from(orderBundleComponents)
      .where(inArray(orderBundleComponents.orderItemId, itemIds));
    for (const component of components) {
      const list = componentsByItemId.get(component.orderItemId) ?? [];
      list.push(component);
      componentsByItemId.set(component.orderItemId, list);
    }
  }

  return { itemsByOrderId, componentsByItemId };
}

export interface WineRequirementRow {
  productId: string;
  /** Order-time snapshot name (never live `Product.name` — Phase 9 §9). */
  productName: string;
  bottles: number;
}

/**
 * Exact per-wine physical requirements for a campaign (docs/04
 * §28, BR-REQ-001). Deliberately does NOT filter by order status,
 * payment status, settlement status, or seller assignment beyond what
 * `calculateWineRequirements()` itself excludes (CANCELLED only) — the
 * single source of truth for that exclusion stays in the pure domain
 * function, never duplicated here (Phase 9 §10). Display names come
 * from order-time snapshots (`OrderItem.nameSnapshot` /
 * `OrderBundleComponent.productNameSnapshot`), never a live join back
 * to `products` — a later rename must never change what preparation
 * shows for a historical order.
 */
export async function getCampaignWineRequirements(
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<WineRequirementRow[]> {
  const campaignOrders = await dbHandle
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.campaignId, campaignId));
  if (campaignOrders.length === 0) {
    return [];
  }

  const { itemsByOrderId, componentsByItemId } = await loadOrderItemsWithBundleComponents(
    campaignOrders.map((order) => order.id),
    dbHandle,
  );

  const productNames = new Map<string, string>();
  const requirementInputs: WineRequirementOrderInput[] = campaignOrders.map((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    return {
      status: order.status,
      items: items.map((item) => {
        if (item.itemType === "PRODUCT" && item.productId) {
          productNames.set(item.productId, item.nameSnapshot);
          return {
            itemType: "PRODUCT" as const,
            productId: item.productId,
            quantity: item.quantity,
          };
        }

        const components = componentsByItemId.get(item.id) ?? [];
        for (const component of components) {
          productNames.set(component.productId, component.productNameSnapshot);
        }
        return {
          itemType: "BUNDLE" as const,
          quantity: item.quantity,
          bundleComponents: components.map((component) => ({
            productId: component.productId,
            quantityPerBundle: component.quantityPerBundle,
          })),
        };
      }),
    };
  });

  const requirements = calculateWineRequirements(requirementInputs);

  return Object.entries(requirements)
    .map(([productId, bottles]) => ({
      productId,
      productName: productNames.get(productId) ?? productId,
      bottles,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, "fr-CH"));
}

/**
 * Total physical bottle count per order in a campaign — PRODUCT item
 * quantity, or BUNDLE item quantity × the sum of its snapshot
 * components' `quantityPerBundle` (Phase 9 §23/§24). Purely a display
 * convenience for the "Toutes les commandes"/bulk-selection lists;
 * never used for the authoritative per-wine aggregate, which stays in
 * `getCampaignWineRequirements()`/`calculateWineRequirements()`.
 */
export async function getCampaignOrderBottleCounts(
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<Map<string, number>> {
  const campaignOrders = await dbHandle
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.campaignId, campaignId));

  const { itemsByOrderId, componentsByItemId } = await loadOrderItemsWithBundleComponents(
    campaignOrders.map((order) => order.id),
    dbHandle,
  );

  const counts = new Map<string, number>();
  for (const order of campaignOrders) {
    const items = itemsByOrderId.get(order.id) ?? [];
    let total = 0;
    for (const item of items) {
      if (item.itemType === "PRODUCT") {
        total += item.quantity;
        continue;
      }
      const components = componentsByItemId.get(item.id) ?? [];
      const bottlesPerBundle = components.reduce(
        (sum, component) => sum + component.quantityPerBundle,
        0,
      );
      total += item.quantity * bottlesPerBundle;
    }
    counts.set(order.id, total);
  }
  return counts;
}

/**
 * Marks an order PREPARED (Phase 9 §14/§17). Central preparation has no
 * seller requirement — see `canPrepareOrder`.
 */
export async function markOrderPrepared(id: string, adminUserId: string, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }
    if (!canPrepareOrder(existing)) {
      throw new InvalidFulfilmentTransitionError();
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: "PREPARED", preparedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "ORDER_PREPARED",
      actorType: "ADMIN",
      adminUserId,
    });

    return updated!;
  });
}

/**
 * Hands an order to its assigned seller (Phase 9 §14/§18). Requires
 * PREPARED status AND an assigned seller — the two failure modes get
 * distinct error types so order detail can explain the missing seller
 * specifically rather than a generic "not eligible" message.
 */
export async function handOrderToSeller(id: string, adminUserId: string, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }
    if (existing.status !== "PREPARED") {
      throw new InvalidFulfilmentTransitionError();
    }
    if (existing.sellerId === null) {
      throw new SellerRequiredForHandoffError();
    }
    if (!canHandOrderToSeller(existing)) {
      throw new InvalidFulfilmentTransitionError();
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: "HANDED_TO_SELLER", handedToSellerAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "ORDER_HANDED_TO_SELLER",
      actorType: "ADMIN",
      adminUserId,
    });

    return updated!;
  });
}

/** Marks an order DELIVERED (Phase 9 §14/§19). Never touches payment/settlement state — see §3 of the approved plan. */
export async function markOrderDelivered(id: string, adminUserId: string, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!existing) {
      throw new OrderNotFoundError(id);
    }
    if (!canMarkOrderDelivered(existing)) {
      throw new InvalidFulfilmentTransitionError();
    }

    const [updated] = await tx
      .update(orders)
      .set({ status: "DELIVERED", deliveredAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "ORDER_DELIVERED",
      actorType: "ADMIN",
      adminUserId,
    });

    return updated!;
  });
}

function uniqueIds(orderIds: string[]): string[] {
  return Array.from(new Set(orderIds));
}

async function loadAndValidateBulkOrders(tx: DbHandle, ids: string[], campaignId: string) {
  if (ids.length === 0) {
    throw new EmptyFulfilmentSelectionError();
  }

  const rows = await tx.select().from(orders).where(inArray(orders.id, ids));
  if (rows.length !== ids.length) {
    throw new InvalidBulkFulfilmentSelectionError();
  }
  for (const row of rows) {
    if (row.campaignId !== campaignId) {
      throw new InvalidBulkFulfilmentSelectionError();
    }
  }
  return rows;
}

export interface BulkPrepareInput {
  campaignId: string;
  orderIds: string[];
  adminId: string;
}

/**
 * Bulk preparation (Phase 9 §7/§17). One transaction, all-or-nothing:
 * every submitted id is reloaded and re-validated server-side; if ANY
 * is ineligible, the whole batch is rejected — never a partial result.
 */
export async function bulkPrepareOrders(input: BulkPrepareInput, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const ids = uniqueIds(input.orderIds);
    const rows = await loadAndValidateBulkOrders(tx, ids, input.campaignId);

    for (const row of rows) {
      if (!canPrepareOrder(row)) {
        throw new InvalidBulkFulfilmentSelectionError();
      }
    }

    const now = new Date();
    await tx
      .update(orders)
      .set({ status: "PREPARED", preparedAt: now })
      .where(inArray(orders.id, ids));

    for (const id of ids) {
      await tx.insert(orderEvents).values({
        orderId: id,
        type: "ORDER_PREPARED",
        actorType: "ADMIN",
        adminUserId: input.adminId,
      });
    }

    return { count: ids.length };
  });
}

export interface BulkHandToSellerInput {
  campaignId: string;
  sellerId: string;
  orderIds: string[];
  adminId: string;
}

/**
 * Seller-scoped bulk handoff (Phase 9 §7/§18). Every selected order
 * must already belong to the given seller — no mixed-seller handoff.
 */
export async function bulkHandOrdersToSeller(
  input: BulkHandToSellerInput,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const ids = uniqueIds(input.orderIds);
    const rows = await loadAndValidateBulkOrders(tx, ids, input.campaignId);

    for (const row of rows) {
      if (row.sellerId !== input.sellerId || row.status !== "PREPARED") {
        throw new InvalidBulkFulfilmentSelectionError();
      }
    }

    const now = new Date();
    await tx
      .update(orders)
      .set({ status: "HANDED_TO_SELLER", handedToSellerAt: now })
      .where(inArray(orders.id, ids));

    for (const id of ids) {
      await tx.insert(orderEvents).values({
        orderId: id,
        type: "ORDER_HANDED_TO_SELLER",
        actorType: "ADMIN",
        adminUserId: input.adminId,
      });
    }

    return { count: ids.length };
  });
}

export interface BulkDeliverInput {
  campaignId: string;
  sellerId: string;
  orderIds: string[];
  adminId: string;
}

/**
 * Seller-scoped bulk delivery (Phase 9 §7/§19) — scoped by seller for
 * the same reason as handoff: prevents an accidental cross-seller bulk
 * action, and every HANDED_TO_SELLER order already has a seller anyway.
 */
export async function bulkMarkOrdersDelivered(input: BulkDeliverInput, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const ids = uniqueIds(input.orderIds);
    const rows = await loadAndValidateBulkOrders(tx, ids, input.campaignId);

    for (const row of rows) {
      if (row.sellerId !== input.sellerId || row.status !== "HANDED_TO_SELLER") {
        throw new InvalidBulkFulfilmentSelectionError();
      }
    }

    const now = new Date();
    await tx
      .update(orders)
      .set({ status: "DELIVERED", deliveredAt: now })
      .where(inArray(orders.id, ids));

    for (const id of ids) {
      await tx.insert(orderEvents).values({
        orderId: id,
        type: "ORDER_DELIVERED",
        actorType: "ADMIN",
        adminUserId: input.adminId,
      });
    }

    return { count: ids.length };
  });
}
