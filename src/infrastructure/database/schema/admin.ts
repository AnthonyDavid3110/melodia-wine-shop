import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.helpers";
import { authUsers } from "./auth";

/**
 * The stable Melodia domain/audit identity for an administrator —
 * distinct from Better Auth's `auth_users` (Phase 3 Gate 1 decision:
 * authentication identity and domain identity remain separate).
 *
 * `email`/`name` are domain/profile snapshots, NOT authentication
 * authorities — `auth_users.email` is authoritative for login. They
 * are deliberately not kept in lockstep with `auth_users` on every
 * login (Gate 1/Gate 2 decision — no implicit sync behaviour).
 *
 * `active` is the SINGLE authoritative ECM authorization flag — never
 * Better Auth's own state. `authUserId` links to the auth identity;
 * RESTRICT (not CASCADE) because unlinking an admin's login must be a
 * deliberate action, consistent with this schema's RESTRICT-by-default
 * policy for anything an audit/financial FK could reach (OrderEvent and
 * SellerSettlement reference `admin_users.id`, never `auth_users.id`
 * directly — see src/infrastructure/database/schema/orders.ts).
 */
export const adminUsers = pgTable("admin_users", {
  id: idColumn(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  authUserId: uuid("auth_user_id")
    .unique()
    .references(() => authUsers.id, { onDelete: "restrict" }),
  ...timestampColumns(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});
