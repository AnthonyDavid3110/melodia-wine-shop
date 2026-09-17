import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaigns } from "./campaigns";

/**
 * Wine category. Kept as plain `text` (not a Postgres enum) on purpose —
 * docs/04-DATA-MODEL.md §6 explicitly says the implementation "should
 * not unnecessarily prevent additional categories later." The exported
 * type below documents the V1-expected values without locking the
 * database to them.
 */
export type ProductCategory = "WHITE" | "RED" | "ROSE";

/** A wine, independent of any specific campaign (docs/04-DATA-MODEL.md §6). */
export const products = pgTable("products", {
  id: idColumn(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  producer: text("producer"),
  category: text("category").notNull().$type<ProductCategory>(),
  vintage: integer("vintage"),
  region: text("region"),
  grapeVariety: text("grape_variety"),
  shortDescription: text("short_description"),
  description: text("description"),
  tastingNotes: text("tasting_notes"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  ...timestampColumns(),
});

/**
 * Campaign-specific availability/pricing for a Product
 * (docs/04-DATA-MODEL.md §7). The same wine can appear in multiple
 * campaigns at different prices; this row holds the campaign-specific
 * commercial configuration, never the Product row itself.
 *
 * FK policy: RESTRICT on both sides. Campaign and Product are master
 * data (deactivate, never delete — docs/04-DATA-MODEL.md §31/§33), so
 * deleting either while a CampaignProduct association references it is
 * blocked at the database level (see Gate 2 report for the full policy).
 */
export const campaignProducts = pgTable(
  "campaign_products",
  {
    id: idColumn(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    unitPriceAmount: integer("unit_price_amount").notNull(),
    active: boolean("active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestampColumns(),
  },
  (table) => [
    unique("campaign_products_campaign_product_unique").on(table.campaignId, table.productId),
    check("campaign_products_unit_price_non_negative", sql`${table.unitPriceAmount} >= 0`),
    index("campaign_products_campaign_id_idx").on(table.campaignId),
  ],
);
