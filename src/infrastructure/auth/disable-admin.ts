import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { adminUsers, authSessions } from "../database/schema";

export interface DisableAdminResult {
  adminId: string;
  sessionsRevoked: boolean;
}

/**
 * Disables an administrator (Gate 1 §9/§14, Gate 2 decision 6):
 * admin_users.active = false, then revoke every live Better Auth
 * session for their linked auth identity.
 *
 * Session revocation is a direct delete against `auth_sessions`, not a
 * Better Auth API call — verified while building this that neither
 * option actually fits:
 *
 * - core `auth.api.revokeSessions()` operates on `ctx.context.session`,
 *   i.e. the CALLER's own session (self-service "log out everywhere"),
 *   not an arbitrary target user
 *   (node_modules/better-auth/dist/api/routes/session.mjs);
 * - the admin plugin's `auth.api.revokeUserSessions()` does take a
 *   target userId, but is gated by `adminMiddleware`, which requires
 *   the caller's session to already carry an admin `role` — a second
 *   authority this project deliberately does not maintain (Gate 1 §2).
 *
 * We already own and fully model `auth_sessions` (Gate 2A schema
 * review), so a plain delete is simpler and more honest than routing
 * through Better Auth's API surface for an operation it does not
 * actually expose the way our architecture needs.
 *
 * Deliberate ordering: `admin_users.active` flips first, in its own
 * statement, and is what actually matters — requireAdmin() rejects
 * this admin the instant that commits, regardless of what happens
 * next. Session deletion runs second; if it throws, the admin is
 * already unable to pass authorization for any *new* request (the
 * failure mode is "an already-open browser tab might still respond
 * until Better Auth's normal session expiry", not "the disable didn't
 * take effect"), so `active = false` is not rolled back — the caller
 * is told explicitly via the returned flag so this can be surfaced or
 * retried rather than silently swallowed.
 */
export async function disableAdmin(adminId: string): Promise<DisableAdminResult> {
  const [admin] = await db
    .update(adminUsers)
    .set({ active: false })
    .where(eq(adminUsers.id, adminId))
    .returning({ id: adminUsers.id, authUserId: adminUsers.authUserId });

  if (!admin) {
    throw new Error(`disableAdmin: no admin_users row with id ${adminId}.`);
  }

  if (!admin.authUserId) {
    // Nothing to revoke — this admin was never linked to an auth identity.
    return { adminId: admin.id, sessionsRevoked: true };
  }

  try {
    await db.delete(authSessions).where(eq(authSessions.userId, admin.authUserId));
    return { adminId: admin.id, sessionsRevoked: true };
  } catch {
    return { adminId: admin.id, sessionsRevoked: false };
  }
}
