import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * PostgreSQL integration tests — requires local Docker Postgres running
 * (`docker compose up -d`) and a migrated database (`pnpm db:migrate`).
 * Deliberately separate from vitest.config.ts so `pnpm test` never
 * needs a database. Run with `pnpm test:db`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` (imported by src/lib/auth/dal.ts) throws
      // unconditionally under plain Node — its guarantee is normally
      // enforced by Next's bundler picking the package's "react-server"
      // export condition, not by Node runtime semantics. Vitest runs in
      // plain Node, so point it at the package's own no-op `empty.js`
      // (the same file Next resolves to under that condition) for tests
      // only; the real app build is untouched and still enforces it.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["src/infrastructure/database/integration/vitest.setup.ts"],
    include: ["src/infrastructure/database/integration/**/*.test.ts"],
    // Constraint/transaction tests share one Postgres instance and rely
    // on transaction-rollback isolation (see integration/setup.ts), not
    // on running in a single process — but running test files
    // sequentially avoids exhausting the small local connection pool.
    fileParallelism: false,
  },
});
