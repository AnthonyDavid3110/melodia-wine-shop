import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaigns } from "./campaigns";
import { sellers } from "./sellers";
import { adminUsers } from "./admin";
import { orders } from "./orders";
import { settlementStatusEnum } from "./enums";

/**
 * Money a seller collected from customers that must be remitted to ECM
 * (docs/04-DATA-MODEL.md §21, docs/08-PAYMENTS.md §34-§38). Distinct
 * from customerPaymentStatus on Order — Customer→Seller and
 * Seller→ECM are two separate financial transitions (TBD-DATA-004,
 * resolved: grouped settlement model).
 */
export const sellerSettlements = pgTable(
  "seller_settlements",
  {
    id: idColumn(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "restrict" }),
    /** Application-calculated from associated SellerSettlementOrder rows — never admin-typed. */
    amount: integer("amount").notNull(),
    status: settlementStatusEnum("status").notNull().default("PENDING"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    recordedByAdminUserId: uuid("recorded_by_admin_user_id").references(() => adminUsers.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    ...timestampColumns(),
  },
  (table) => [
    check("seller_settlements_amount_positive", sql`${table.amount} > 0`),
    index("seller_settlements_seller_id_idx").on(table.sellerId),
    index("seller_settlements_campaign_id_idx").on(table.campaignId),
  ],
);

/**
 * Associates a SellerSettlement with the orders it covers
 * (docs/04-DATA-MODEL.md §22). `orderId` is unique on its own (not a
 * composite with sellerSettlementId): this is what actually enforces
 * "an order can belong to at most one settlement, ever" — the
 * "same seller-payment amount cannot be settled twice" invariant
 * (docs/08-PAYMENTS.md §56 invariant 9).
 */
export const sellerSettlementOrders = pgTable(
  "seller_settlement_orders",
  {
    id: idColumn(),
    sellerSettlementId: uuid("seller_settlement_id")
      .notNull()
      .references(() => sellerSettlements.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
  },
  (table) => [
    check("seller_settlement_orders_amount_positive", sql`${table.amount} > 0`),
    index("seller_settlement_orders_seller_settlement_id_idx").on(table.sellerSettlementId),
  ],
);
