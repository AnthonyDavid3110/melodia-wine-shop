// .env.local is loaded by vitest.setup.ts (Vitest's setupFiles, run
// before any test file's imports) — see vitest.config.db.ts.
import { db } from "../client";

export { db };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type { Tx };

class RollbackSignal extends Error {}

/**
 * Runs `fn` inside a real PostgreSQL transaction that is ALWAYS rolled
 * back afterward, whether `fn` succeeds or throws — this is the test
 * isolation mechanism for the whole integration suite: every test gets
 * a clean slate and leaves no trace, with no manual cleanup/truncation
 * bookkeeping, so repeated `pnpm test:db` runs stay deterministic
 * regardless of order.
 *
 * For an operation that is *expected* to fail (proving a PostgreSQL
 * constraint) while the test still needs to keep using the transaction
 * afterward, wrap just that operation in a nested `tx.transaction()` —
 * Drizzle implements nested transactions as real SAVEPOINTs, so only
 * that inner operation rolls back; the outer transaction (and this
 * function's own rollback-at-the-end) is unaffected.
 */
export async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (error instanceof RollbackSignal) {
      return result as T;
    }
    throw error;
  }
  /* c8 ignore next */
  throw new Error("unreachable: transaction committed instead of rolling back");
}
