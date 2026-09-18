/**
 * Administrator bootstrap (Phase 3 Gate 2A/2B — docs/10-IMPLEMENTATION-PLAN.md
 * Phase 3 §30: "Provide a safe mechanism to create the first
 * administrator... Do not hardcode production credentials in source
 * code.").
 *
 * Run with `pnpm bootstrap:admin`. Interactive only — no email,
 * password, or any other credential is ever hardcoded, seeded, or
 * accepted as a CLI argument (arguments end up in shell history /
 * process listings; interactive stdin does not). The password is never
 * printed, logged, or echoed back. Core logic lives in
 * ./bootstrap-admin-core.ts (testable directly, no prompts); this file
 * is only the interactive wrapper around it.
 *
 * Prompting uses `@inquirer/prompts` (`input`/`password`) rather than a
 * hand-rolled `stdout.write` monkey-patch over Node's raw `readline`
 * module: a first version of this file implemented masked-password
 * input by intercepting `process.stdout.write` around a
 * `readline/promises` `question()` call, and it hung indefinitely after
 * the password was typed — Node's `readline` `Interface` does its own
 * TTY cursor/raw-mode bookkeeping around `output.write` internally, and
 * that hand-rolled interception broke it in a way that never surfaced
 * an error (the failure was discovered via a real interactive run, not
 * caught by any automated test, since masked-input TTY behaviour isn't
 * observable through a piped test harness). `@inquirer/prompts` is
 * actively maintained, handles this correctly, and needing masked stdin
 * input is exactly the kind of "does the platform already solve it"
 * case CLAUDE.md's dependency policy (§38) says to use a library for
 * rather than re-implement.
 *
 * SPIKE RESULT (see the Gate 2A report for the full trace): public
 * sign-up is disabled via `emailAndPassword.disableSignUp: true`
 * (src/infrastructure/auth/config.ts). Reading Better Auth 1.7.5's own
 * source (node_modules/better-auth/dist/api/routes/sign-up.mjs) proves
 * this check is the FIRST thing inside the shared `/sign-up/email`
 * handler — `auth.api.signUpEmail()` runs that exact handler, so it is
 * blocked identically to the public HTTP route. There is no bypass.
 *
 * Chosen alternative: ./bootstrap-admin-core.ts builds its OWN Better
 * Auth instance from the exact same shared config (same database, same
 * schema, same secret, same password/session rules — see ./config.ts)
 * with only `emailAndPassword.disableSignUp` overridden to `false`.
 * This changes nothing about the deployed application's configuration
 * — the real instance (./server.ts) always keeps `disableSignUp: true`;
 * only this standalone, manually-invoked script ever constructs the
 * differently-configured instance, for its own process only. (An
 * alternative existed — the admin plugin's `auth.api.createUser`, which
 * does not check `disableSignUp` at all — but adopting it would add the
 * admin plugin's `role`/`banned`/`banReason`/`banExpires` schema onto
 * `auth_users`, reintroducing exactly the second "is this admin
 * allowed in" authority Gate 1 decided against. The config-override
 * approach needs no plugin and no extra schema.)
 *
 * ATOMICITY: creating the Better Auth identity (auth_users +
 * auth_accounts) and creating/linking the domain admin_users row cannot
 * be one physical PostgreSQL transaction — they go through two
 * independent code paths (Better Auth's own adapter-internal
 * transaction, then our own separate insert) with no documented hook to
 * join them. Failure mode: if the process dies between the two steps,
 * an auth identity exists with no linked admin_users row. That
 * identity cannot pass requireAdmin() (no admin_users.authUserId points
 * at it) — a safe failure direction, not a security hole — and running
 * this script again with the same email detects and links the orphaned
 * identity instead of failing or creating a duplicate (idempotent
 * recovery, proven in tests).
 */
import { config } from "dotenv";
import { input, password as passwordPrompt } from "@inquirer/prompts";

// Run via `tsx` directly (not Next.js), so .env.local is not loaded
// automatically — load it before importing anything that constructs
// the database client or a Better Auth instance.
config({ path: ".env.local" });

const { bootstrapAdmin } = await import("./bootstrap-admin-core");

async function main() {
  console.log("Melodia Wine Shop — administrator bootstrap\n");

  const email = (
    await input({
      message: "Admin email:",
      validate: (value) => (value.includes("@") ? true : "A valid email is required."),
    })
  ).toLowerCase();

  const name = await input({
    message: "Admin name:",
    validate: (value) => (value.trim().length > 0 ? true : "A name is required."),
  });

  const password = await passwordPrompt({
    message: "Admin password:",
    mask: true,
    validate: (value) => (value.length >= 8 ? true : "Password must be at least 8 characters."),
  });
  await passwordPrompt({
    message: "Confirm password:",
    mask: true,
    validate: (value) => (value === password ? true : "Passwords did not match."),
  });

  const result = await bootstrapAdmin({ email, name, password });

  if (result.recoveredExistingAuthIdentity) {
    console.log(
      `Found an existing, unlinked authentication identity for ${email} (from a previously-interrupted run) — linked it rather than creating a new one. The password you just entered was not used.`,
    );
  } else {
    console.log(`Created authentication identity ${result.authUserId} for ${email}.`);
  }

  console.log(
    `\nAdministrator created: admin_users.id=${result.adminId}, linked to auth identity ${result.authUserId}.`,
  );
  console.log("Done. The password was not logged or displayed above.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("\nBootstrap failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
