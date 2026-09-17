import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Standard UUID primary key, database-generated. */
export function idColumn() {
  return uuid("id").primaryKey().defaultRandom();
}

/**
 * Standard createdAt/updatedAt pair. updatedAt uses Drizzle's `$onUpdate`
 * callback (application-level, ORM-write-path only) rather than a
 * Postgres trigger — this app has a single writer (itself), so the
 * simpler approach is sufficient (see Gate 2 report for the tradeoff).
 */
export function timestampColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}
