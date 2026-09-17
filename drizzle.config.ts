import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI process (not the Next.js app), so it
// does not automatically get Next.js's .env.local loading — load it
// explicitly, matching this project's local-dev convention (.env.example).
config({ path: ".env.local" });

/**
 * `drizzle-kit generate` does not need a live database connection (it
 * only reads the schema files and prior migration snapshots), but
 * `dbCredentials.url` must still be a non-empty string for the config
 * to validate. `drizzle-kit migrate` does need a real connection, and
 * must use the DIRECT/unpooled Neon connection string, not the pooled
 * one the application uses at runtime (Neon's own guidance: a pooled
 * connection string can cause migration errors).
 */
export default defineConfig({
  out: "./drizzle",
  schema: "./src/infrastructure/database/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
