import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { campaignStatusEnum } from "./enums";

/** One annual fundraising wine sale (docs/04-DATA-MODEL.md §5). */
export const campaigns = pgTable(
  "campaigns",
  {
    id: idColumn(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    publicTitle: text("public_title"),
    description: text("description"),
    status: campaignStatusEnum("status").notNull().default("DRAFT"),
    openingDate: timestamp("opening_date", { withTimezone: true }),
    closingDate: timestamp("closing_date", { withTimezone: true }),
    /** Minor units; per-seller CampaignSeller.targetAmount overrides this when set. */
    defaultSellerTargetAmount: integer("default_seller_target_amount"),
    ...timestampColumns(),
  },
  (table) => [
    check(
      "campaigns_dates_order_check",
      sql`${table.openingDate} IS NULL OR ${table.closingDate} IS NULL OR ${table.openingDate} <= ${table.closingDate}`,
    ),
    check(
      "campaigns_default_seller_target_amount_non_negative",
      sql`${table.defaultSellerTargetAmount} IS NULL OR ${table.defaultSellerTargetAmount} >= 0`,
    ),
  ],
);
