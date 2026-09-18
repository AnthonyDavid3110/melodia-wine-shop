import { check, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
    /**
     * Phase 4 Gate 2 invariant: at most one ACTIVE campaign at a time
     * (docs/04-DATA-MODEL.md §5, "the public campaign" resolution — see
     * the Gate 2A migration report). A partial unique index, not a
     * plain unique constraint on `status`, because most rows are
     * DRAFT/CLOSED/ARCHIVED and must coexist freely; only the ACTIVE
     * value is constrained. Zero ACTIVE campaigns remains valid (the
     * index has nothing to enforce when no row matches the predicate).
     */
    uniqueIndex("campaigns_one_active_idx")
      .on(table.status)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
);
