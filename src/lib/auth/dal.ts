import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/infrastructure/auth/server";
import { db } from "@/infrastructure/database/client";
import { adminUsers } from "@/infrastructure/database/schema";

export interface AuthenticatedAdmin {
  /** admin_users.id — the identity every OrderEvent/SellerSettlement audit reference uses. */
  adminId: string;
  authUserId: string;
  email: string;
  name: string;
}

/**
 * The domain half of the authorization check — given a Better Auth
 * user id (or null/undefined when there is no valid session), looks up
 * the linked admin_users row **by authUserId, never by email**, and
 * rejects when there is none or when `active` is false (the single
 * authoritative ECM authorization flag — Gate 1 §5/§9).
 *
 * Deliberately separated from `getAuthenticatedAdmin` below so it can
 * be exercised directly in integration tests without a real Next.js
 * request context (`next/headers` only works inside one) — see
 * src/infrastructure/database/integration/auth.db.test.ts.
 */
export async function resolveAdminFromAuthUserId(
  authUserId: string | null | undefined,
): Promise<AuthenticatedAdmin | null> {
  if (!authUserId) {
    return null;
  }

  const [admin] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      active: adminUsers.active,
      authUserId: adminUsers.authUserId,
    })
    .from(adminUsers)
    .where(eq(adminUsers.authUserId, authUserId));

  if (!admin || !admin.active || !admin.authUserId) {
    return null;
  }

  return { adminId: admin.id, authUserId: admin.authUserId, email: admin.email, name: admin.name };
}

/**
 * The one, authoritative authorization check for this application
 * (Phase 3 Gate 1 §10/§17). Deliberately the ONLY place that:
 *
 * 1. validates the Better Auth session server-side (never trusts a
 *    client-supplied claim — cookieCache is off, so this always hits
 *    the database, per Gate 2 decision 12);
 * 2. delegates the domain lookup to `resolveAdminFromAuthUserId`
 *    (by authUserId, never by email; rejects inactive admins).
 *
 * Wrapped in React's `cache()` so a render pass that calls this from
 * several Server Components/Actions only hits the database once. This
 * is a *request-scoped* cache, not a time-based one — cookieCache being
 * off means every new request re-validates from scratch, which is the
 * point (see the "disabled admin" tests).
 *
 * Proxy (src/proxy.ts) performs a cheap, optimistic, cookie-presence-only
 * pre-check ahead of this — never the reverse. This function is the
 * only source of actual authority anywhere in the app; every protected
 * Server Component, Server Action, and Route Handler must call it (or
 * `getAdminOrNull`) itself, not rely on a parent layout having done so
 * (Next.js layouts don't re-run on sibling navigation — see the Gate 1
 * report for the verified reasoning).
 */
const getAuthenticatedAdmin = cache(async (): Promise<AuthenticatedAdmin | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.session || !result.user) {
    return null;
  }

  return resolveAdminFromAuthUserId(result.user.id);
});

/**
 * For Server Components and Server Actions: redirects to the login
 * page when unauthorized rather than returning a value the caller
 * might forget to check.
 */
export async function requireAdmin(): Promise<AuthenticatedAdmin> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    redirect("/admin/connexion");
  }
  return admin;
}

/**
 * For Route Handlers, which need 401/403 semantics instead of a
 * redirect. Shares the exact same authorization logic as
 * `requireAdmin` (via the cached core above) — never a second,
 * divergent implementation.
 */
export async function getAdminOrNull(): Promise<AuthenticatedAdmin | null> {
  return getAuthenticatedAdmin();
}
