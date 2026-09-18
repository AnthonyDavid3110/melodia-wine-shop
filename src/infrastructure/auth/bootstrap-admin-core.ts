import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { db } from "../database/client";
import { adminUsers, authUsers } from "../database/schema";
import { createAuthConfig } from "./config";

export interface BootstrapAdminInput {
  email: string;
  name: string;
  password: string;
}

export interface BootstrapAdminResult {
  adminId: string;
  authUserId: string;
  /** True when an orphaned auth identity from a previously-interrupted run was linked instead of creating a new one. */
  recoveredExistingAuthIdentity: boolean;
}

export class DuplicateAdministratorError extends Error {
  constructor(email: string, existingAdminId: string) {
    super(
      `An administrator with email ${email} already exists (admin_users.id=${existingAdminId}). Refusing to create a duplicate.`,
    );
    this.name = "DuplicateAdministratorError";
  }
}

/**
 * The testable core of `pnpm bootstrap:admin` — no prompts, no
 * process.exit, so it can be exercised directly by integration tests
 * (including the required "duplicate bootstrap does not silently
 * create duplicates" and "idempotent recovery" cases). See
 * bootstrap-admin.ts for the interactive CLI wrapper and the full
 * design rationale (spike result, atomicity/compensation reasoning).
 */
export async function bootstrapAdmin(input: BootstrapAdminInput): Promise<BootstrapAdminResult> {
  const email = input.email.toLowerCase();

  const [existingAdmin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  if (existingAdmin) {
    throw new DuplicateAdministratorError(email, existingAdmin.id);
  }

  const [existingAuthUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));

  let authUserId: string;
  let recoveredExistingAuthIdentity: boolean;

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;
    recoveredExistingAuthIdentity = true;
  } else {
    const bootstrapAuth = betterAuth(
      createAuthConfig({
        // `signUpEmail` auto-signs-in by default (creates a live
        // auth_sessions row and returns its token) — verified from
        // node_modules/better-auth/dist/api/routes/sign-up.mjs. This
        // script never uses that token (the administrator logs in for
        // real, later, through the login page), so leaving autoSignIn
        // on would silently leave an orphaned, never-consumed session
        // behind after every bootstrap run. Disabled explicitly.
        emailAndPassword: { disableSignUp: false, autoSignIn: false },
      }),
    );
    const result = await bootstrapAuth.api.signUpEmail({
      body: { name: input.name, email, password: input.password },
    });
    if (!result?.user?.id) {
      throw new Error("Better Auth did not return a created user — aborting.");
    }
    authUserId = result.user.id;
    recoveredExistingAuthIdentity = false;
  }

  const [admin] = await db
    .insert(adminUsers)
    .values({ email, name: input.name, active: true, authUserId })
    .returning({ id: adminUsers.id });

  if (!admin) {
    throw new Error(
      `Created/linked authentication identity ${authUserId}, but failed to create the admin_users row. ` +
        "Re-run with the same email — it will detect and link the existing identity safely.",
    );
  }

  return { adminId: admin.id, authUserId, recoveredExistingAuthIdentity };
}
