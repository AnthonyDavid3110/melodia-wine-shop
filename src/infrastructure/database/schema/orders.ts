import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaigns } from "./campaigns";
import { sellers } from "./sellers";
import { products } from "./products";
import { bundles } from "./bundles";
import { adminUsers } from "./admin";
import {
  actorTypeEnum,
  customerPaymentStatusEnum,
  orderItemTypeEnum,
  orderSellerSettlementStatusEnum,
  orderSourceEnum,
  orderStatusEnum,
} from "./enums";

/**
 * The central commercial entity (docs/04-DATA-MODEL.md §13). Customer
 * contact fields are an immutable order-time snapshot (no Customer
 * entity in V1 — see docs/04-DATA-MODEL.md §12); operational status,
 * customer payment status, and seller settlement status are three
 * independent fields and must never be inferred from one another
 * (docs/02-BUSINESS-RULES.md BR-PAY-005, BR-STA-001).
 */
export const orders = pgTable(
  "orders",
  {
    id: idColumn(),
    /** Human-readable ECM-YYYY-NNNN, generated via orderNumberCounters — never the primary key. */
    orderNumber: text("order_number").notNull().unique(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    source: orderSourceEnum("source").notNull(),

    // Order-time customer snapshot — never re-read from a live Customer record.
    customerFirstName: text("customer_first_name").notNull(),
    customerLastName: text("customer_last_name").notNull(),
    customerAddress: text("customer_address").notNull(),
    customerPostalCode: text("customer_postal_code").notNull(),
    customerCity: text("customer_city").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    deliveryNote: text("delivery_note"),

    /** Nullable: an order may be created without a seller ("unassigned"). */
    sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "restrict" }),

    currency: text("currency").notNull().default("CHF"),
    subtotalAmount: integer("subtotal_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),

    status: orderStatusEnum("status").notNull().default("NEW"),
    customerPaymentStatus: customerPaymentStatusEnum("customer_payment_status")
      .notNull()
      .default("PENDING"),
    sellerSettlementStatus: orderSellerSettlementStatusEnum("seller_settlement_status")
      .notNull()
      .default("NOT_APPLICABLE"),

    ...timestampColumns(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    handedToSellerAt: timestamp("handed_to_seller_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    check("orders_subtotal_amount_non_negative", sql`${table.subtotalAmount} >= 0`),
    check("orders_total_amount_non_negative", sql`${table.totalAmount} >= 0`),
    index("orders_campaign_id_idx").on(table.campaignId),
    index("orders_seller_id_idx").on(table.sellerId),
    index("orders_status_idx").on(table.status),
    index("orders_customer_payment_status_idx").on(table.customerPaymentStatus),
  ],
);

/**
 * One commercial line in an Order — an individual wine or a bundle
 * (docs/04-DATA-MODEL.md §15/§16). Commercially relevant fields are
 * snapshotted at order time; a later Product/Bundle price change must
 * never alter this row (BR-PRO-002, BR-PRI-003).
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    itemType: orderItemTypeEnum("item_type").notNull(),
    /** Exactly one of productId/bundleId is set, matching itemType — enforced below. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    bundleId: uuid("bundle_id").references(() => bundles.id, { onDelete: "restrict" }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceAmount: integer("unit_price_amount").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalAmount: integer("line_total_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_unit_price_non_negative", sql`${table.unitPriceAmount} >= 0`),
    check("order_items_line_total_non_negative", sql`${table.lineTotalAmount} >= 0`),
    check(
      "order_items_item_type_reference_consistency",
      sql`(${table.itemType} = 'PRODUCT' AND ${table.productId} IS NOT NULL AND ${table.bundleId} IS NULL)
          OR (${table.itemType} = 'BUNDLE' AND ${table.bundleId} IS NOT NULL AND ${table.productId} IS NULL)`,
    ),
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    index("order_items_bundle_id_idx").on(table.bundleId),
  ],
);

/**
 * Order-time snapshot of one bundle's composition (docs/04-DATA-MODEL.md
 * §17). Critical: wine requirements must be computed from these rows,
 * never from the live BundleItem configuration, so a later bundle-
 * composition change cannot alter historical fulfilment.
 */
export const orderBundleComponents = pgTable(
  "order_bundle_components",
  {
    id: idColumn(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    quantityPerBundle: integer("quantity_per_bundle").notNull(),
  },
  (table) => [
    check("order_bundle_components_quantity_positive", sql`${table.quantityPerBundle} > 0`),
    index("order_bundle_components_order_item_id_idx").on(table.orderItemId),
    index("order_bundle_components_product_id_idx").on(table.productId),
  ],
);

/**
 * Lightweight append-only audit trail (docs/04-DATA-MODEL.md §25).
 * `type` is deliberately plain `text`, not an enum — the specification
 * explicitly says "the exact event list may evolve" (§25); this is
 * display/audit metadata, not a business state machine.
 */
export const orderEvents = pgTable(
  "order_events",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, { onDelete: "restrict" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_id_idx").on(table.orderId)],
);

/**
 * Infrastructure table (not a domain entity from docs/04-DATA-MODEL.md)
 * backing safe concurrent generation of ECM-YYYY-NNNN order numbers: one
 * row per year, incremented atomically via
 * `INSERT ... ON CONFLICT (year) DO UPDATE SET last_value = last_value + 1 RETURNING last_value`
 * inside the future order-creation transaction (Phase 6/7 — not built
 * yet). `year` is its own natural key, so this is the one table without
 * a UUID surrogate `id`.
 */
export const orderNumberCounters = pgTable(
  "order_number_counters",
  {
    year: integer("year").primaryKey(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (table) => [check("order_number_counters_last_value_non_negative", sql`${table.lastValue} >= 0`)],
);
