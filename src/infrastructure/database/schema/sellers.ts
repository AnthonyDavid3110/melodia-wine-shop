import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaigns } from "./campaigns";

/** An ECM member who can receive sales attribution and deliver orders (docs/04-DATA-MODEL.md §10). */
export const sellers = pgTable("sellers", {
  id: idColumn(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestampColumns(),
});

/** Campaign-specific seller participation and target (docs/04-DATA-MODEL.md §11). */
export const campaignSellers = pgTable(
  "campaign_sellers",
  {
    id: idColumn(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(true),
    /** Minor units. Falls back to Campaign.defaultSellerTargetAmount when null. */
    targetAmount: integer("target_amount"),
    ...timestampColumns(),
  },
  (table) => [
    unique("campaign_sellers_campaign_seller_unique").on(table.campaignId, table.sellerId),
    check(
      "campaign_sellers_target_amount_non_negative",
      sql`${table.targetAmount} IS NULL OR ${table.targetAmount} >= 0`,
    ),
    index("campaign_sellers_campaign_id_idx").on(table.campaignId),
  ],
);
