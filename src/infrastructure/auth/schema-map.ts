import {
  authAccounts,
  authRateLimits,
  authSessions,
  authUsers,
  authVerifications,
} from "../database/schema/auth";

/**
 * Maps Better Auth's canonical internal table names to our
 * auth-prefixed Drizzle tables (Gate 1/Gate 2 decision — distinguishes
 * "Better-Auth-owned, CLI-derived" tables from our own domain tables at
 * a glance). Shared by every Better Auth instance (the real app server
 * and the bootstrap script's local instance) so they always agree on
 * where data lives.
 */
export const authSchemaMap = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
  rateLimit: authRateLimits,
};
