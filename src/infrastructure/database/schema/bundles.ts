import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaigns } from "./campaigns";
import { products } from "./products";

/** A predefined set of wines sold at a fixed price (docs/04-DATA-MODEL.md §8). */
export const bundles = pgTable(
  "bundles",
  {
    id: idColumn(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description"),
    description: text("description"),
    imageUrl: text("image_url"),
    priceAmount: integer("price_amount").notNull(),
    active: boolean("active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestampColumns(),
  },
  (table) => [
    check("bundles_price_amount_non_negative", sql`${table.priceAmount} >= 0`),
    index("bundles_campaign_id_idx").on(table.campaignId),
  ],
);

/**
 * One product line inside a Bundle's current configuration
 * (docs/04-DATA-MODEL.md §9). This is the *current* composition, used
 * for display and as the source snapshotted onto OrderBundleComponent
 * at order time — it is never read to reconstruct a historical order.
 */
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: idColumn(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    check("bundle_items_quantity_positive", sql`${table.quantity} > 0`),
    unique("bundle_items_bundle_product_unique").on(table.bundleId, table.productId),
    index("bundle_items_bundle_id_idx").on(table.bundleId),
  ],
);
