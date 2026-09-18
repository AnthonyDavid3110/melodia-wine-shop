import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { BetterAuthOptions } from "better-auth";
import { db } from "../database/client";
import { authSchemaMap } from "./schema-map";

/**
 * Shared Better Auth configuration, deliberately factored out of the
 * real app instance (./server.ts) so the bootstrap script
 * (./bootstrap-admin.ts) can reuse every setting — same database, same
 * schema, same secret/session/rate-limit behaviour — while overriding
 * only `emailAndPassword.disableSignUp` for its own one-off process.
 * See the Gate 2A report for why that specific override is safe and
 * does not touch the deployed app's configuration.
 *
 * Gate 1/Gate 2 decisions encoded here:
 * - email/password only, no social providers (docs/09-SECURITY.md,
 *   Gate 1 §7/§10/§11);
 * - no public registration (`disableSignUp: true`, overridden only by
 *   the bootstrap script's local instance);
 * - no 2FA plugin (deferred, Gate 2 decision 14);
 * - cookieCache left disabled (Gate 2 decision 12 — this is already
 *   Better Auth's own default, so it is simply omitted below);
 * - database-backed rate limiting (Gate 2 decision 13) — required
 *   because Vercel serverless instances don't share in-memory state;
 * - UUID identity generation (`advanced.database.generateId: "uuid"`)
 *   for consistency with every other table in this schema.
 */
export function createAuthConfig(overrides?: {
  emailAndPassword?: Partial<NonNullable<BetterAuthOptions["emailAndPassword"]>>;
  /** Test-only: rate limiting is disabled outside production by Better Auth's own default (see below) — a focused test overrides `enabled`/`window`/`max` to exercise the database storage path directly. Never overridden by the deployed app or the bootstrap script. */
  rateLimit?: Partial<NonNullable<BetterAuthOptions["rateLimit"]>>;
}): BetterAuthOptions {
  return {
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchemaMap,
      // Better Auth's own multi-table writes (e.g. sign-up creating a
      // user + account together) are NOT wrapped in a real transaction
      // unless requested — our driver supports real transactions
      // (Phase 2/3 client.ts), so ask for it explicitly.
      transaction: true,
    }),

    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Never wider than our own production domain + local dev — see
    // docs/05-ARCHITECTURE.md and Gate 1 §11.
    trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      // Deliberately NOT configuring `sendResetPassword` yet (Gate 2B
      // correction). Better Auth requires this callback to actually
      // deliver a reset email; without it, `requestPasswordReset`
      // safely fails closed with a 400 "RESET_PASSWORD_DISABLED" and
      // never generates a token or a reset URL at all — see
      // node_modules/better-auth/dist/api/routes/password.mjs. Logging
      // the reset URL server-side (a prior draft of this file did that)
      // would have been a bearer-token-in-logs exposure with no real
      // delivery mechanism behind it — not an acceptable "temporary"
      // measure. The real flow arrives with Phase 11's EmailProvider
      // (Resend); until then, password reset is architecturally
      // supported by Better Auth but intentionally non-functional.
      ...overrides?.emailAndPassword,
    },

    rateLimit: {
      // Better Auth's own default ("enabled only in production") is
      // already correct for us; the storage choice is what actually
      // needs to be explicit, since the in-memory default silently
      // stops working the moment Vercel runs more than one instance.
      storage: "database",
      ...overrides?.rateLimit,
    },

    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  };
}
