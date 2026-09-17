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
