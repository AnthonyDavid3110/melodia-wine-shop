import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
