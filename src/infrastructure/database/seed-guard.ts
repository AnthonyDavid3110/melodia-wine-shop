/**
 * Pre-connection authorization for the development seed script
 * (seed.ts). Gate 15B safety prerequisite: seeding is forbidden unless
 * explicitly authorized, rather than allowed unless production is
 * detected.
 *
 * `NODE_ENV` describes the Node runtime mode, not the identity of the
 * database target — a manual `pnpm db:seed` from a local shell usually
 * has it unset, even when the connection string has been pointed at a
 * real (e.g. production Neon) database. Hostname inspection was
 * rejected as the primary safeguard: it would require hard-coding
 * provider-specific identifiers and would still not distinguish a
 * staging Neon project from a production one.
 *
 * Deliberately has no imports: seed.ts calls this before importing
 * anything that reads database configuration or constructs a client.
 */

export const SEED_AUTHORIZATION_VARIABLE = "ALLOW_DATABASE_SEED";

export type SeedAuthorizationInput = {
  /**
   * ALLOW_DATABASE_SEED as set by the invoking shell, captured BEFORE
   * .env.local is loaded. Only this value can authorize a seed.
   */
  shellAuthorization: string | undefined;
  /**
   * ALLOW_DATABASE_SEED after .env.local has been loaded. Never
   * authorizes on its own — used only to explain a refusal when the
   * value came from the env file.
   */
  loadedAuthorization: string | undefined;
  /** NODE_ENV after .env.local has been loaded (shell value wins, per dotenv). */
  nodeEnv: string | undefined;
};

export type SeedAuthorizationDecision = { allowed: true } | { allowed: false; reason: string };

const HOW_TO_ENABLE = [
  "To seed a local development database intentionally, set it for this one command only:",
  "  bash / Git Bash:  ALLOW_DATABASE_SEED=true pnpm db:seed",
  "  PowerShell:       $env:ALLOW_DATABASE_SEED='true'; pnpm db:seed; Remove-Item Env:ALLOW_DATABASE_SEED",
  "Never enable it against production.",
].join("\n");

export function decideSeedAuthorization(input: SeedAuthorizationInput): SeedAuthorizationDecision {
  if (input.nodeEnv === "production") {
    return {
      allowed: false,
      reason:
        "Refusing to run the development seed script with NODE_ENV=production. The seed inserts fictional demo data and must never target production, whatever ALLOW_DATABASE_SEED says.",
    };
  }

  if (input.shellAuthorization === "true") {
    return { allowed: true };
  }

  if (input.shellAuthorization !== undefined) {
    return {
      allowed: false,
      reason: `Refusing to run the development seed script: ALLOW_DATABASE_SEED must be exactly "true" to authorize seeding.\n${HOW_TO_ENABLE}`,
    };
  }

  if (input.loadedAuthorization !== undefined) {
    return {
      allowed: false,
      reason: `Refusing to run the development seed script: ALLOW_DATABASE_SEED was found in .env.local, which is ignored by design — an authorization stored in a file would apply silently to every future run, including one whose database URL has been changed.\n${HOW_TO_ENABLE}`,
    };
  }

  return {
    allowed: false,
    reason: `Refusing to run the development seed script: seeding requires explicit authorization (ALLOW_DATABASE_SEED=true), and none was given for this command. The seed inserts fictional demo data into whichever database DATABASE_URL points at.\n${HOW_TO_ENABLE}`,
  };
}
