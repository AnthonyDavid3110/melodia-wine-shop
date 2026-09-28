import { check, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn } from "./columns.helpers";

/**
 * Fixed-window application-level rate limiting (Phase 14 Gate 14B,
 * docs/09-SECURITY.md — closes the confirmed Gate 14A HIGH finding:
 * unauthenticated checkout/payment-initiation abuse). Deliberately NOT
 * associated with any campaign/order/payment row — abuse identity is a
 * property of the requester and the action, not of which campaign
 * happens to be active (approved Step 1 §14).
 *
 * `identityHash` is an opaque HMAC-SHA-256 digest
 * (`derive-rate-limit-identity.ts`) of the caller's normalized IP (or
 * the shared `"unknown"` fallback) — the raw IP is never computed
 * anywhere near a DB write and is never persisted. `action` is
 * deliberately plain `text`, not an enum, mirroring `orderEvents.type`'s
 * own precedent — a small internal categorical tag expected to grow as
 * later gates add buckets, never a fixed business state machine.
 *
 * `windowStart` is part of the row's own identity (folded into the
 * unique constraint below), not a separate lookup — this is what makes
 * expiry automatic: a row from an old window is simply never addressed
 * again once time moves past it, with no explicit "is this expired?"
 * check needed in the hot path (approved Step 1 §6/§12). Physical
 * cleanup of old rows is a deterministic housekeeping concern (see
 * `rate-limit.ts`), never a correctness requirement.
 */
export const checkoutRateLimits = pgTable(
  "checkout_rate_limits",
  {
    id: idColumn(),
    identityHash: text("identity_hash").notNull(),
    action: text("action").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [
    unique("checkout_rate_limits_identity_action_window_unique").on(
      table.identityHash,
      table.action,
      table.windowStart,
    ),
    check("checkout_rate_limits_count_positive", sql`${table.count} > 0`),
    index("checkout_rate_limits_window_start_idx").on(table.windowStart),
  ],
);
