import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeonServerless } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool as NodePgPool } from "pg";
import ws from "ws";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Two drivers, one schema, real transactions in both — see the Gate 3
 * report for the full reasoning. Summary:
 *
 * `@neondatabase/serverless`'s Pool/Client speak WebSocket to Neon's
 * proxy; that proxy is Neon-specific infrastructure, so this driver
 * cannot reach a plain local Postgres without an extra translating
 * sidecar (Neon's own `wsproxy` container) — unnecessary local
 * infrastructure we decided against. `pg` (node-postgres) speaks the
 * plain Postgres wire protocol over TCP, which both local Docker
 * Postgres and Neon support natively — but using a plain `pg.Pool`
 * against Neon from Vercel's serverless functions is a known
 * anti-pattern (connections aren't reused between invocations the way
 * a long-lived server assumes).
 *
 * Driver selection is the explicit `DATABASE_DRIVER` server-only
 * environment variable ("postgres" | "neon"), never inferred from the
 * hosting platform (e.g. a `VERCEL` env var). Hosting (Vercel) and
 * database provider (Neon) are separate architectural concerns: a
 * future deployment target other than Vercel would still need
 * `neon-serverless` to talk to Neon, and a Vercel deployment could in
 * principle point at plain Postgres. Coupling the driver choice to the
 * hosting platform would hide that distinction.
 *
 * `drizzle-orm/node-postgres` and `drizzle-orm/neon-serverless` both
 * implement Drizzle's common `PgDatabase` interface against the same
 * `pg-core` schema, so every query/transaction in the domain and
 * infrastructure layers is identical source code against either driver
 * — nothing above this file needs to know which one is active.
 */

if (!serverEnv.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not configured. Set it in .env.local (see .env.example) — a local Postgres connection string in development, the pooled Neon connection string in production.",
  );
}

if (!serverEnv.DATABASE_DRIVER) {
  throw new Error(
    'DATABASE_DRIVER is not configured. Set it in .env.local to "postgres" (local Docker Postgres) or "neon" (Neon) — see .env.example.',
  );
}

function createDb() {
  if (serverEnv.DATABASE_DRIVER === "neon") {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: serverEnv.DATABASE_URL });
    return drizzleNeonServerless(pool, { schema });
  }

  const pool = new NodePgPool({ connectionString: serverEnv.DATABASE_URL });
  return drizzleNodePostgres(pool, { schema });
}

/**
 * Application-wide database handle. Module-level singleton, reused
 * across invocations within a warm serverless instance — do not
 * construct a new Pool per request. Importing this module is itself the
 * "point of use": nothing before Gate 3B imports it, so DATABASE_URL/
 * DATABASE_DRIVER being unset does not affect the build/tests/dev
 * server before then.
 */
export const db = createDb();
