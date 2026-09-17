import { sql } from "drizzle-orm";
import { formatOrderNumber } from "@/domain/order-number";
import type { db } from "./client";
import { orderNumberCounters } from "./schema";

/**
 * Atomically reserves the next sequence number for a given year and
 * returns the formatted ECM-YYYY-NNNN order number. Safe under
 * concurrent callers: the increment is a single
 * `INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING` statement, so
 * PostgreSQL's own row-level locking on the upsert — not application
 * logic — guarantees no two callers ever receive the same value.
 * Deliberately NOT `SELECT MAX(...) + 1`, which is not concurrency-safe.
 *
 * Infrastructure only: this does not create an Order. Order creation
 * (Phase 6/7) will call this inside its own transaction alongside
 * validating the campaign/products/seller and inserting the Order row.
 */
export async function reserveOrderNumber(
  tx: Pick<typeof db, "insert">,
  year: number,
): Promise<string> {
  const [row] = await tx
    .insert(orderNumberCounters)
    .values({ year, lastValue: 1 })
    .onConflictDoUpdate({
      target: orderNumberCounters.year,
      set: { lastValue: sql`${orderNumberCounters.lastValue} + 1` },
    })
    .returning({ lastValue: orderNumberCounters.lastValue });

  if (!row) {
    throw new Error(`reserveOrderNumber: upsert for year ${year} returned no row.`);
  }

  return formatOrderNumber(year, row.lastValue);
}
