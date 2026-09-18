import { z } from "zod";

/**
 * Server-only environment variables.
 * Never import this module from client components.
 */
export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Neon pooled connection string, used by the application at runtime
   * (src/infrastructure/database/client.ts). Optional here: no route or
   * server action queries the database yet (Phase 2 adds schema/domain
   * logic only), so requiring it globally would break every part of the
   * app before a real Neon project exists. The database client itself
   * asserts this is present at the point a connection is constructed —
   * that is where a missing value should fail loudly, not at unrelated
   * module load time.
   */
  DATABASE_URL: z.string().url().optional(),

  /**
   * Neon direct/unpooled connection string. Used only by drizzle-kit
   * (migrations) and the seed script — never by the application at
   * request time. A pooled connection string must not be used for
   * migrations (Neon's own guidance: it can cause errors).
   */
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  /**
   * Explicit database-driver selection — deliberately NOT inferred from
   * the hosting platform (e.g. a `VERCEL` env var). Hosting (Vercel) and
   * database provider (Neon) are separate architectural concerns and
   * must not be implicitly coupled: a future deployment target other
   * than Vercel would still need to talk to Neon via the
   * `neon-serverless` driver, and a Vercel deployment could in principle
   * point at a plain Postgres instance.
   *
   *   postgres — drizzle-orm/node-postgres (local Docker, tests)
   *   neon     — drizzle-orm/neon-serverless (Neon)
   *
   * Optional here for the same reason DATABASE_URL is optional: nothing
   * before Gate 3B imports the database client, so requiring this
   * globally would break unrelated parts of the app. The database
   * client asserts it is set at the point a connection is constructed.
   */
  DATABASE_DRIVER: z.enum(["postgres", "neon"]).optional(),

  /**
   * Signs/encrypts Better Auth sessions. Optional here for the same
   * "don't break unrelated module loads" reason as DATABASE_URL — the
   * auth server instance (src/infrastructure/auth/server.ts) asserts
   * this is present at construction time. Local development may use an
   * explicit fake value (never a real secret); production requires a
   * freshly generated one, never committed.
   */
  BETTER_AUTH_SECRET: z.string().optional(),

  /**
   * Base URL Better Auth uses to build callback links and as the
   * default trusted origin. http://localhost:3000 locally,
   * https://vins.ecmelodia.ch in production.
   */
  BETTER_AUTH_URL: z.string().url().optional(),
});

/**
 * Variables exposed to the browser.
 * Must be prefixed with NEXT_PUBLIC_ and listed explicitly (Next.js inlines
 * them at build time; they cannot be read dynamically from process.env).
 */
export const publicSchema = z.object({});

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export const serverEnv = parseEnv(serverSchema, {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  DATABASE_DRIVER: process.env.DATABASE_DRIVER,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
});

export const publicEnv = parseEnv(publicSchema, {});
