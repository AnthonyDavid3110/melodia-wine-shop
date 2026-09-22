import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Same rationale as vitest.config.db.ts: `server-only` throws
      // unconditionally under plain Node (its guarantee is normally
      // enforced by Next's bundler "react-server" export condition, not
      // Node runtime semantics) — point it at the package's own no-op
      // `empty.js` for tests only. Needed here now that a plain unit
      // test (Phase 10, saferpay-client.test.ts) imports a server-only
      // module directly; the real app build is untouched.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PostgreSQL integration tests live under their own config/script
    // (vitest.config.db.ts, `pnpm test:db`) so `pnpm test` never
    // requires a database.
    exclude: ["**/node_modules/**", "src/infrastructure/database/integration/**"],
  },
});
