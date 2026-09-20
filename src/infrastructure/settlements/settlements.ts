import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../database/client";
import {
  campaignSellers,
  campaigns,
  orderEvents,
  orders,
  payments,
  sellerSettlementOrders,
  sellerSettlements,
  sellers,
} from "../database/schema";
import { CampaignNotFoundError } from "../campaign/campaigns";
import { SellerNotFoundError } from "../sellers/sellers";
import { type Money, money, sumMoney } from "@/domain/money";
import { calculateSellerCollections } from "@/domain/sellers/calculate-seller-collections";
import { calculateSellerProgress } from "@/domain/sellers/calculate-seller-progress";
import { calculateSellerSales } from "@/domain/sellers/calculate-seller-sales";
import { calculateSettlementAmount } from "@/domain/settlements/calculate-settlement-amount";
import { isEligibleForSettlement } from "@/domain/settlements/is-eligible-for-settlement";

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

export class EmptySettlementSelectionError extends Error {
  constructor() {
    super("Sélectionnez au moins une commande à régler.");
    this.name = "EmptySettlementSelectionError";
  }
}

/**
 * Covers every server-side re-validation failure (unknown order id,
 * wrong campaign, wrong seller, not settlement-eligible) with one
 * clean admin-facing message — deliberately not one subclass per
 * cause, since the correct admin response is the same in every case:
 * refresh and re-check the current eligible set (docs/09-SECURITY.md
 * §39, never leak which specific internal check failed).
 */
export class InvalidSettlementOrderError extends Error {
  constructor() {
    super(
      "Une ou plusieurs commandes sélectionnées ne sont plus éligibles à ce règlement. Veuillez actualiser la page et réessayer.",
    );
    this.name = "InvalidSettlementOrderError";
  }
}

/** The `seller_settlement_orders_order_id_unique` backstop fired — a concurrent settlement won the race for at least one selected order. */
export class SettlementConflictError extends Error {
  constructor() {
    super(
      "Une ou plusieurs commandes sélectionnées viennent d'être incluses dans un autre règlement. Veuillez actualiser la page et réessayer.",
    );
    this.name = "SettlementConflictError";
  }
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
 * Every order attributed to this seller within this campaign, with its
 * SELLER/OFFLINE payment row (if any) and whether it's already linked
 * to a settlement — the one query that backs the attributed-orders
 * list, the collections figures, and the eligible-order picker, so
 * these three views can never silently disagree with each other.
 */
async function listSellerCampaignOrderRows(
  sellerId: string,
  campaignId: string,
  dbHandle: DbHandle,
) {
  return dbHandle
    .select({ order: orders, payment: payments, settlementLink: sellerSettlementOrders })
    .from(orders)
    .leftJoin(payments, and(eq(payments.orderId, orders.id), eq(payments.method, "SELLER")))
    .leftJoin(sellerSettlementOrders, eq(sellerSettlementOrders.orderId, orders.id))
    .where(and(eq(orders.sellerId, sellerId), eq(orders.campaignId, campaignId)))
    .orderBy(desc(orders.createdAt));
}

export type SellerCampaignOrderRow = Awaited<
  ReturnType<typeof listSellerCampaignOrderRows>
>[number];

/** The attributed-orders list for seller detail (Phase 8 §20) — every campaign order for this seller, newest first. */
export async function listSellerCampaignOrders(
  sellerId: string,
  campaignId: string,
  dbHandle: DbHandle = db,
) {
  return listSellerCampaignOrderRows(sellerId, campaignId, dbHandle);
}

/** The settlement-eligible subset, using the exact same authoritative rule the transaction itself re-validates (Phase 8 §10). */
export async function listEligibleOrdersForSettlement(
  sellerId: string,
  campaignId: string,
  dbHandle: DbHandle = db,
) {
  const rows = await listSellerCampaignOrderRows(sellerId, campaignId, dbHandle);
  return rows.filter((row) => row.payment && isEligibleForSettlementRow(row));
}

function isEligibleForSettlementRow(row: SellerCampaignOrderRow): boolean {
  if (!row.payment) return false;
  return isEligibleForSettlement({
    paymentMethod: row.payment.method,
    customerPaymentStatus: row.order.customerPaymentStatus,
    sellerId: row.order.sellerId,
    alreadySettled: row.order.sellerSettlementStatus === "SETTLED" || row.settlementLink !== null,
    orderStatus: row.order.status,
  });
}

export interface SellerFinancialSummary {
  sales: Money;
  target: Money;
  progress: number;
  stillToCollect: Money;
  collected: Money;
  stillToRemit: Money;
  remittedToEcm: Money;
}

/**
 * The seller financial view (Phase 8 §17) — every figure derived from
 * authoritative order/payment/settlement data, reusing the existing
 * Phase 2 pure calculators directly. No "online payments" figure is
 * computed or shown: that data doesn't exist yet, and a fake zero would
 * misrepresent the campaign (Phase 8 approved display decision #5).
 */
export async function getSellerFinancialSummary(
  sellerId: string,
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<SellerFinancialSummary> {
  const [campaign] = await dbHandle.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    throw new CampaignNotFoundError(campaignId);
  }
  const [campaignSeller] = await dbHandle
    .select()
    .from(campaignSellers)
    .where(and(eq(campaignSellers.campaignId, campaignId), eq(campaignSellers.sellerId, sellerId)));

  const rows = await listSellerCampaignOrderRows(sellerId, campaignId, dbHandle);

  const sales = calculateSellerSales(
    rows.map((row) => ({ status: row.order.status, totalAmount: row.order.totalAmount as Money })),
  );

  const target = money(campaignSeller?.targetAmount ?? campaign.defaultSellerTargetAmount ?? 0);
  const progress = calculateSellerProgress(sales, target);

  const sellerPaymentRows = rows.filter((row) => row.payment && row.order.status !== "CANCELLED");
  const collections = calculateSellerCollections(
    sellerPaymentRows.map((row) => ({
      totalAmount: row.order.totalAmount as Money,
      customerPaymentStatus: row.order.customerPaymentStatus,
      settled: row.order.sellerSettlementStatus === "SETTLED" || row.settlementLink !== null,
    })),
  );

  const settledSettlements = await dbHandle
    .select({ amount: sellerSettlements.amount })
    .from(sellerSettlements)
    .where(
      and(
        eq(sellerSettlements.sellerId, sellerId),
        eq(sellerSettlements.campaignId, campaignId),
        eq(sellerSettlements.status, "SETTLED"),
      ),
    );
  const remittedToEcm = sumMoney(settledSettlements.map((row) => row.amount as Money));

  return {
    sales,
    target,
    progress: progress.percentage,
    stillToCollect: collections.stillToCollect,
    collected: collections.collected,
    stillToRemit: collections.stillToRemit,
    remittedToEcm,
  };
}

/** Settlement history for seller detail (Phase 8 §22) — immutable, no edit/reversal surface. */
export async function listSellerSettlements(
  sellerId: string,
  campaignId: string,
  dbHandle: DbHandle = db,
) {
  return dbHandle
    .select({ settlement: sellerSettlements, recordedBy: sellers })
    .from(sellerSettlements)
    .leftJoin(sellers, eq(sellers.id, sellerSettlements.sellerId))
    .where(
      and(eq(sellerSettlements.sellerId, sellerId), eq(sellerSettlements.campaignId, campaignId)),
    )
    .orderBy(desc(sellerSettlements.createdAt));
}

/** How many orders a given SellerSettlement includes — used by the history list. */
export async function countSettlementOrders(sellerSettlementId: string, dbHandle: DbHandle = db) {
  const rows = await dbHandle
    .select({ id: sellerSettlementOrders.id })
    .from(sellerSettlementOrders)
    .where(eq(sellerSettlementOrders.sellerSettlementId, sellerSettlementId));
  return rows.length;
}

export interface CreateSettlementInput {
  campaignId: string;
  sellerId: string;
  orderIds: string[];
  adminId: string;
}

/**
 * The seller → ECM half of Phase 8's offline money flow (docs/08 §34-39,
 * docs/04 §21/§22). ONE transaction, all-or-nothing: every submitted
 * order id is re-resolved and re-validated server-side against the
 * SAME `isEligibleForSettlement` rule the picker UI uses — the browser
 * is never trusted for eligibility OR amount (docs/08 §36). Settlement
 * is created directly in its completed `SETTLED` state per the
 * documented single-confirmation admin flow (docs/06 §38-39) — there is
 * no separate draft/PENDING settlement step in V1.
 *
 * Concurrency: `seller_settlement_orders_order_id_unique` is the final
 * backstop if two settlement attempts race for the same order — the
 * losing transaction's insert fails, is caught, and is translated into
 * `SettlementConflictError` rather than a raw constraint message.
 */
export async function createSettlement(input: CreateSettlementInput, dbHandle: DbHandle = db) {
  return dbHandle.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, input.campaignId));
    if (!campaign) {
      throw new CampaignNotFoundError(input.campaignId);
    }
    const [seller] = await tx
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.id, input.sellerId));
    if (!seller) {
      throw new SellerNotFoundError(input.sellerId);
    }

    const uniqueOrderIds = Array.from(new Set(input.orderIds));
    if (uniqueOrderIds.length === 0) {
      throw new EmptySettlementSelectionError();
    }

    const rows = await tx
      .select({ order: orders, payment: payments, settlementLink: sellerSettlementOrders })
      .from(orders)
      .leftJoin(payments, and(eq(payments.orderId, orders.id), eq(payments.method, "SELLER")))
      .leftJoin(sellerSettlementOrders, eq(sellerSettlementOrders.orderId, orders.id))
      .where(inArray(orders.id, uniqueOrderIds));

    if (rows.length !== uniqueOrderIds.length) {
      throw new InvalidSettlementOrderError();
    }

    for (const row of rows) {
      if (row.order.campaignId !== input.campaignId || row.order.sellerId !== input.sellerId) {
        throw new InvalidSettlementOrderError();
      }
      if (!isEligibleForSettlementRow(row)) {
        throw new InvalidSettlementOrderError();
      }
    }

    const amount = calculateSettlementAmount(
      rows.map((row) => ({ amount: row.order.totalAmount as Money })),
    );
    const now = new Date();

    let settlement: typeof sellerSettlements.$inferSelect;
    try {
      settlement = await tx.transaction(async (savepoint) => {
        const [created] = await savepoint
          .insert(sellerSettlements)
          .values({
            campaignId: input.campaignId,
            sellerId: input.sellerId,
            amount,
            status: "SETTLED",
            settledAt: now,
            recordedByAdminUserId: input.adminId,
          })
          .returning();
        if (!created) {
          throw new Error("createSettlement: settlement insert returned no row.");
        }

        for (const row of rows) {
          await savepoint.insert(sellerSettlementOrders).values({
            sellerSettlementId: created.id,
            orderId: row.order.id,
            amount: row.order.totalAmount,
          });
        }

        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error, "seller_settlement_orders_order_id_unique")) {
        throw new SettlementConflictError();
      }
      throw error;
    }

    await tx
      .update(orders)
      .set({ sellerSettlementStatus: "SETTLED" })
      .where(inArray(orders.id, uniqueOrderIds));

    for (const row of rows) {
      await tx.insert(orderEvents).values({
        orderId: row.order.id,
        type: "SETTLEMENT_COMPLETED",
        actorType: "ADMIN",
        adminUserId: input.adminId,
        metadata: { sellerSettlementId: settlement.id },
      });
    }

    return settlement;
  });
}
