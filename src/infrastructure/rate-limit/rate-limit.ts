import { lt, sql } from "drizzle-orm";
import { db } from "../database/client";
import { checkoutRateLimits } from "../database/schema";

type DbHandle = Pick<typeof db, "insert" | "delete">;

/** Physical row retention target (approved Step 1 §12/§6) — generously outlives every current window (max 10 minutes). */
const CLEANUP_RETENTION_SECONDS = 60 * 60;

export interface RateLimitPolicy {
  /** Plain string bucket name — e.g. `"order_creation"` — never an enum (see schema comment). */
  action: string;
  windowSeconds: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Coarse hint only — never exposes the exact window boundary beyond what's needed for a "try again shortly" message. */
  retryAfterSeconds: number;
}

function computeWindowStart(windowSeconds: number, now: Date): Date {
  const epochSeconds = Math.floor(now.getTime() / 1000);
  const windowStartEpoch = Math.floor(epochSeconds / windowSeconds) * windowSeconds;
  return new Date(windowStartEpoch * 1000);
}

/**
 * Opportunistic, deterministic housekeeping (approved Step 1 §12) — runs
 * on every call rather than probabilistically, which keeps both the
 * implementation and its tests simple. Correctness never depends on
 * this succeeding: an old window's row is already ignored by every
 * future request regardless (its `window_start` will never match a
 * newly-computed one again) — this only reclaims storage. A failure
 * here is swallowed rather than allowed to prevent the actual
 * rate-limit decision below from being returned.
 */
async function cleanupExpiredRows(dbHandle: DbHandle, now: Date): Promise<void> {
  try {
    const cutoff = new Date(now.getTime() - CLEANUP_RETENTION_SECONDS * 1000);
    await dbHandle.delete(checkoutRateLimits).where(lt(checkoutRateLimits.windowStart, cutoff));
  } catch {
    // Housekeeping only — never let a cleanup failure affect limiting.
  }
}

/**
 * Atomically consumes one unit of the given identity+action's current
 * fixed window (Phase 14 Gate 14B, approved Step 1 §11) via a single
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement — the same
 * idiom this codebase already uses for `reserveOrderNumber()`
 * (`order-number-counter.ts`). PostgreSQL's own row-level locking on the
 * upsert target is the concurrency primitive: two simultaneous callers
 * for the same identity/action/window cannot both observe the same
 * pre-increment count, because the increment and the read of the new
 * value are the same atomic statement, not a separate
 * read-then-write pair.
 *
 * Never returns or logs the identity hash beyond what the caller
 * already has; never exposes the raw count/limit to callers beyond the
 * boolean decision and a coarse retry hint.
 */
export async function consumeRateLimit(
  identityHash: string,
  policy: RateLimitPolicy,
  dbHandle: DbHandle = db,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  await cleanupExpiredRows(dbHandle, now);

  const windowStart = computeWindowStart(policy.windowSeconds, now);
  const [row] = await dbHandle
    .insert(checkoutRateLimits)
    .values({ identityHash, action: policy.action, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [
        checkoutRateLimits.identityHash,
        checkoutRateLimits.action,
        checkoutRateLimits.windowStart,
      ],
      set: { count: sql`${checkoutRateLimits.count} + 1` },
    })
    .returning({ count: checkoutRateLimits.count });

  if (!row) {
    throw new Error("consumeRateLimit: upsert returned no row.");
  }

  const windowEndEpochSeconds = Math.floor(windowStart.getTime() / 1000) + policy.windowSeconds;
  const retryAfterSeconds = Math.max(0, windowEndEpochSeconds - Math.floor(now.getTime() / 1000));

  return { allowed: row.count <= policy.limit, retryAfterSeconds };
}
