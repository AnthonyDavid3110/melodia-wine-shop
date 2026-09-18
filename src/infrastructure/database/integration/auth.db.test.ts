import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { resolveAdminFromAuthUserId } from "@/lib/auth/dal";
import { auth } from "@/infrastructure/auth/server";
import { createAuthConfig } from "@/infrastructure/auth/config";
import { disableAdmin } from "@/infrastructure/auth/disable-admin";
import {
  DuplicateAdministratorError,
  bootstrapAdmin,
} from "@/infrastructure/auth/bootstrap-admin-core";
import { adminUsers, authAccounts, authRateLimits, authSessions, authUsers } from "../schema";
import { db } from "./setup";
import { unique } from "./fixtures";

/**
 * Better Auth's own adapter manages its own connection/transaction via
 * the shared `db` singleton internally — it does not accept an
 * injectable `tx`, so these tests (which exercise real
 * bootstrapAdmin/disableAdmin/DAL code, all of which use that same
 * singleton) cannot use the withRollback-per-test pattern the rest of
 * this suite uses (see schema-constraints.db.test.ts). Rows really
 * commit here; every test tracks the email(s) it created and
 * afterEach() deletes them explicitly. The pure schema-constraint tests
 * at the bottom of this file (UNIQUE/RESTRICT on authUserId) don't
 * touch Better Auth at all and do use withRollback, like the rest of
 * the suite.
 */

const createdEmails: string[] = [];

function testEmail(label: string): string {
  const email = `${unique(label)}@example.test`;
  createdEmails.push(email);
  return email;
}

afterEach(async () => {
  while (createdEmails.length > 0) {
    const email = createdEmails.pop();
    if (!email) continue;

    await db.delete(adminUsers).where(eq(adminUsers.email, email));
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));
    if (authUser) {
      await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
      await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
    }
  }
});

describe("public signup is disabled", () => {
  it("rejects auth.api.signUpEmail on the real app instance", async () => {
    const email = testEmail("signup-disabled");
    await expect(
      auth.api.signUpEmail({ body: { name: "Nobody", email, password: "irrelevant123" } }),
    ).rejects.toThrow();

    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));
    expect(authUser).toBeUndefined();
  });

  it("the deployed app's auth instance always has disableSignUp=true", () => {
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });
});

describe("bootstrapAdmin", () => {
  it("creates a linked auth identity and admin_users row", async () => {
    const email = testEmail("bootstrap");
    const result = await bootstrapAdmin({
      email,
      name: "Bootstrap Admin",
      password: "correct-horse-1",
    });

    expect(result.recoveredExistingAuthIdentity).toBe(false);

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, result.adminId));
    expect(admin?.email).toBe(email);
    expect(admin?.active).toBe(true);
    expect(admin?.authUserId).toBe(result.authUserId);

    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.id, result.authUserId));
    expect(authUser?.email).toBe(email);

    const [account] = await db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, result.authUserId));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();

    // signUpEmail auto-signs-in by default and would otherwise leave an
    // orphaned, never-consumed session behind — bootstrap-admin-core.ts
    // explicitly disables that (autoSignIn: false).
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, result.authUserId));
    expect(sessions).toHaveLength(0);
  });

  it("refuses a duplicate bootstrap for the same email rather than creating a second administrator", async () => {
    const email = testEmail("bootstrap-dup");
    await bootstrapAdmin({ email, name: "First", password: "correct-horse-1" });

    await expect(
      bootstrapAdmin({ email, name: "Second", password: "correct-horse-2" }),
    ).rejects.toThrow(DuplicateAdministratorError);

    const admins = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    expect(admins).toHaveLength(1);
  });

  it("recovers an orphaned auth identity from an interrupted prior run instead of failing or duplicating", async () => {
    const email = testEmail("bootstrap-recovery");

    // Simulate step 1 of a prior run having succeeded (auth identity
    // created) while step 2 (admin_users insert) never happened —
    // exactly the documented non-atomic failure mode.
    const orphan = await bootstrapAdmin({ email, name: "Orphan", password: "correct-horse-1" });
    await db.delete(adminUsers).where(eq(adminUsers.id, orphan.adminId));

    const recovered = await bootstrapAdmin({
      email,
      name: "Orphan",
      password: "different-password",
    });

    expect(recovered.recoveredExistingAuthIdentity).toBe(true);
    expect(recovered.authUserId).toBe(orphan.authUserId);

    const admins = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    expect(admins).toHaveLength(1);
    const authUsersForEmail = await db.select().from(authUsers).where(eq(authUsers.email, email));
    expect(authUsersForEmail).toHaveLength(1);
  });

  it("never logs the password", async () => {
    const email = testEmail("bootstrap-no-log");
    const password = "this-must-never-appear-in-any-log-output";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await bootstrapAdmin({ email, name: "Quiet Admin", password });

      const allLoggedArgs = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat();
      for (const arg of allLoggedArgs) {
        expect(String(arg)).not.toContain(password);
      }
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("resolveAdminFromAuthUserId (DAL core)", () => {
  it("returns null when there is no linked admin_users row (e.g. no session at all)", async () => {
    expect(await resolveAdminFromAuthUserId(null)).toBeNull();
    expect(await resolveAdminFromAuthUserId(undefined)).toBeNull();
  });

  it("returns null for a valid Better Auth identity with no admin_users row (anonymous-equivalent)", async () => {
    const email = testEmail("no-admin-row");
    const { authUserId } = await bootstrapAdmin({
      email,
      name: "Temp",
      password: "correct-horse-1",
    });
    // Remove the admin_users row while keeping the auth identity — a
    // "valid Better Auth user without admin_users row" scenario.
    await db.delete(adminUsers).where(eq(adminUsers.authUserId, authUserId));

    expect(await resolveAdminFromAuthUserId(authUserId)).toBeNull();
  });

  it("returns null for a valid session linked to an inactive admin", async () => {
    const email = testEmail("inactive-admin");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "Inactive Admin",
      password: "correct-horse-1",
    });
    await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, adminId));

    expect(await resolveAdminFromAuthUserId(authUserId)).toBeNull();
  });

  it("allows a valid session linked to an active admin", async () => {
    const email = testEmail("active-admin");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "Active Admin",
      password: "correct-horse-1",
    });

    const resolved = await resolveAdminFromAuthUserId(authUserId);
    expect(resolved).toEqual({ adminId, authUserId, email, name: "Active Admin" });
  });

  it("looks up by authUserId, not by email — mismatched emails still resolve correctly", async () => {
    const email = testEmail("lookup-by-id");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "ID Lookup Admin",
      password: "correct-horse-1",
    });

    // Gate 2 decision 4: admin_users.email is a snapshot, not kept in
    // sync with auth_users.email. Deliberately desynchronize it and
    // prove resolution still works — it can only be working via
    // authUserId if it survives this.
    const desyncedEmail = testEmail("lookup-by-id-desynced");
    await db.update(adminUsers).set({ email: desyncedEmail }).where(eq(adminUsers.id, adminId));

    const resolved = await resolveAdminFromAuthUserId(authUserId);
    expect(resolved?.adminId).toBe(adminId);
    expect(resolved?.email).toBe(desyncedEmail); // not the original auth email — proves the lookup key was authUserId
  });

  it("rejects a random/unknown authUserId (direct protected mutation without authorization)", async () => {
    expect(await resolveAdminFromAuthUserId(randomUUID())).toBeNull();
  });
});

describe("disableAdmin", () => {
  it("makes the admin unresolvable and revokes their sessions", async () => {
    const email = testEmail("disable-admin");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "To Be Disabled",
      password: "correct-horse-1",
    });

    // A live session for this admin, as if they were logged in.
    await db.insert(authSessions).values({
      userId: authUserId,
      token: unique("session-token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(await resolveAdminFromAuthUserId(authUserId)).not.toBeNull();

    const result = await disableAdmin(adminId);
    expect(result.sessionsRevoked).toBe(true);

    expect(await resolveAdminFromAuthUserId(authUserId)).toBeNull();

    const remainingSessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, authUserId));
    expect(remainingSessions).toHaveLength(0);
  });

  it("admin_users.active=false alone denies authorization, independent of session state", async () => {
    const email = testEmail("active-false-invariant");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "Invariant Admin",
      password: "correct-horse-1",
    });
    await db.insert(authSessions).values({
      userId: authUserId,
      token: unique("session-token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Flip `active` directly, WITHOUT going through disableAdmin (so the
    // session row is deliberately left untouched) — proves `active` is
    // the authority on its own, not merely a side effect of session
    // cleanup also having happened.
    await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, adminId));

    expect(await resolveAdminFromAuthUserId(authUserId)).toBeNull();

    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, authUserId));
    expect(sessions).toHaveLength(1);
  });

  it("disabling an already-disabled admin is safe and idempotent", async () => {
    const email = testEmail("disable-idempotent");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "Repeat Disable",
      password: "correct-horse-1",
    });
    await db.insert(authSessions).values({
      userId: authUserId,
      token: unique("session-token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const first = await disableAdmin(adminId);
    expect(first.sessionsRevoked).toBe(true);

    const second = await disableAdmin(adminId);
    expect(second.sessionsRevoked).toBe(true);
    expect(second.adminId).toBe(adminId);

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
    expect(admin?.active).toBe(false);
  });

  it("a failure to delete sessions never reactivates the administrator", async () => {
    const email = testEmail("disable-session-delete-fails");
    const { adminId, authUserId } = await bootstrapAdmin({
      email,
      name: "Delete Fails",
      password: "correct-horse-1",
    });
    await db.insert(authSessions).values({
      userId: authUserId,
      token: unique("session-token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const deleteSpy = vi.spyOn(db, "delete").mockImplementation(() => {
      throw new Error("simulated session-deletion failure");
    });
    try {
      const result = await disableAdmin(adminId);
      expect(result.sessionsRevoked).toBe(false);
    } finally {
      deleteSpy.mockRestore();
    }

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
    expect(admin?.active).toBe(false);
    // The session row this test inserted is cleaned up by afterEach,
    // which deletes auth_sessions by the tracked email's authUserId
    // regardless of whether disableAdmin's own delete succeeded.
  });
});

describe("rate limiting persists to auth_rate_limits, not in-memory (Gate 2B)", () => {
  it("a burst of sign-in attempts is throttled and recorded in the database", async () => {
    // Better Auth disables rate limiting outside production by default
    // (see node_modules/.../better-auth/dist/context/create-context.mjs:
    // `enabled: options.rateLimit?.enabled ?? isProduction`) — this
    // throwaway instance overrides only that flag, reusing every other
    // setting (including `storage: "database"`) from the real shared
    // config, to prove the database storage path is actually wired up
    // rather than silently falling back to Better Auth's in-memory Map.
    const rateLimitedAuth = betterAuth(createAuthConfig({ rateLimit: { enabled: true } }));

    // Default special rule for /sign-in* is window=10s, max=3 (Better
    // Auth's own built-in default — not something this project set).
    const attempt = () =>
      rateLimitedAuth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "nobody@ratelimit.test", password: "wrong-password" }),
        }),
      );

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await attempt();
      statuses.push(response.status);
    }

    expect(statuses.at(-1)).toBe(429);

    const rows = await db
      .select()
      .from(authRateLimits)
      .where(like(authRateLimits.key, "%sign-in%"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.count >= 3)).toBe(true);

    // Global state (not scoped to a test email) — clean up explicitly.
    for (const row of rows) {
      await db.delete(authRateLimits).where(eq(authRateLimits.id, row.id));
    }
  });
});
