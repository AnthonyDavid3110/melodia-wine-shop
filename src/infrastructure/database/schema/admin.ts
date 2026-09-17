import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.helpers";

/**
 * Minimal domain-level administrator representation — id, email, name,
 * active flag, so OrderEvent/SellerSettlement can reference "which admin
 * did this" now. Better Auth's own required tables (session, account,
 * verification) are intentionally NOT anticipated here; they belong to
 * Phase 3 and must be based on Better Auth's then-current schema
 * requirements (TBD-DATA-006 stays open).
 */
export const adminUsers = pgTable("admin_users", {
  id: idColumn(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestampColumns(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});
