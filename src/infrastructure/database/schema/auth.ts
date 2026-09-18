import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.helpers";

/**
 * Better Auth's core schema (Phase 3 Gate 2A) — auth-prefixed per Gate 1
 * decision, to read as "Better-Auth-owned, CLI-derived" at a glance
 * next to our own domain tables. Field lists verified two ways: against
 * the installed `better-auth@1.7.5` package's internal Zod schemas
 * (`@better-auth/core/db/schema/*`), and cross-checked by actually
 * running `npx auth@1.7.5 generate` against this exact configuration
 * (src/infrastructure/auth/config.ts) — the CLI's own schema validator
 * caught one real gap the Zod types alone didn't show (`rateLimit.id`,
 * see below). Deliberate, reviewed deviations from the CLI's raw
 * output: `auth_`-prefixed table names (Gate 1 decision), `timestamptz`
 * instead of naive `timestamp` (matches this project's existing
 * timezone-safety convention — docs/04-DATA-MODEL.md §36 — and Better
 * Auth has no dependency on naive-timestamp semantics), and an added
 * `(providerId, accountId)` unique constraint on `auth_accounts` (the
 * CLI output doesn't enforce it, but Better Auth's own `AccountKey`
 * type documents this pair as the stable identity of an account, so
 * enforcing it protects a real invariant without conflicting with any
 * documented Better Auth write path).
 *
 * FK policy deliberately differs from every other table in this
 * schema: these three tables are live authentication-protocol state
 * that Better Auth itself creates/expires/deletes as part of normal
 * operation, not historical/financial/audit records — so, unlike the
 * RESTRICT-everywhere policy Phase 2 established, `auth_sessions` and
 * `auth_accounts` CASCADE from `auth_users`. This is the first genuine
 * CASCADE candidate in the whole schema, for exactly the reason Phase
 * 2's Gate 3A report predicted one would eventually appear: a truly
 * ephemeral entity with no audit significance of its own.
 *
 * `admin_users` — the actual audit/financial identity — is untouched
 * by any of this and keeps its RESTRICT-everywhere policy unchanged.
 */

export const authUsers = pgTable("auth_users", {
  id: idColumn(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestampColumns(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestampColumns(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    /** e.g. "credential" for email/password — no social providers in V1 (Gate 1 §7/§11). */
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    /** scrypt hash (Better Auth default) for the "credential" provider; null for any future non-password provider. */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    ...timestampColumns(),
  },
  (table) => [
    unique("auth_accounts_provider_account_unique").on(table.providerId, table.accountId),
    index("auth_accounts_user_id_idx").on(table.userId),
  ],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: idColumn(),
    /** Typically the email/target the token was issued for (e.g. password reset). */
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

/**
 * Database-backed rate-limit storage (Gate 2 decision 13 — required
 * because Vercel serverless instances don't share Better Auth's default
 * in-memory store). `rateLimitSchema`'s Zod type (the API-layer schema)
 * only shows `key`/`count`/`lastRequest`, but the CLI's schema
 * validator — run against this exact table via `authSchemaMap` —
 * reported `rateLimit.id` as a genuinely missing column when it was
 * absent; the database layer needs an `id` primary key that the Zod
 * schema doesn't mention. `key` stays unique/not-null (Better Auth's
 * own lookup key), `id` is the surrogate PK for consistency with every
 * other table. `lastRequest` is an epoch-milliseconds number, which
 * already exceeds Postgres `integer` range today — must be `bigint`.
 */
export const authRateLimits = pgTable("auth_rate_limits", {
  id: idColumn(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
