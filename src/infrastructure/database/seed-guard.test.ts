import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decideSeedAuthorization } from "./seed-guard";

describe("decideSeedAuthorization", () => {
  it("refuses under NODE_ENV=production even with explicit authorization", () => {
    const decision = decideSeedAuthorization({
      shellAuthorization: "true",
      loadedAuthorization: "true",
      nodeEnv: "production",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/NODE_ENV=production/);
  });

  it("refuses when no authorization is given (NODE_ENV unset)", () => {
    const decision = decideSeedAuthorization({
      shellAuthorization: undefined,
      loadedAuthorization: undefined,
      nodeEnv: undefined,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/requires explicit authorization/);
      expect(decision.reason).toContain("ALLOW_DATABASE_SEED=true pnpm db:seed");
    }
  });

  it("refuses when the authorization only comes from .env.local", () => {
    const decision = decideSeedAuthorization({
      shellAuthorization: undefined,
      loadedAuthorization: "true",
      nodeEnv: "development",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/found in \.env\.local/);
  });

  it.each(["1", "yes", "TRUE", "", " true"])(
    "refuses a shell value other than exactly 'true' (%j)",
    (value) => {
      const decision = decideSeedAuthorization({
        shellAuthorization: value,
        loadedAuthorization: value,
        nodeEnv: "development",
      });
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.reason).toMatch(/must be exactly "true"/);
    },
  );

  it.each([undefined, "development", "test"])(
    "allows explicit shell authorization outside production (NODE_ENV=%s)",
    (nodeEnv) => {
      expect(
        decideSeedAuthorization({
          shellAuthorization: "true",
          loadedAuthorization: "true",
          nodeEnv,
        }),
      ).toEqual({ allowed: true });
    },
  );
});

/**
 * Runs the real seed.ts entry point in a child process, from a
 * throwaway working directory (so the developer's own .env.local is
 * never loaded), with every database variable replaced. No test here
 * can reach a real database: refusal cases use an invalid
 * DATABASE_DRIVER as a tripwire — if ./client (and therefore
 * src/lib/env.ts) were ever imported, env validation would fail with a
 * different error — and the authorized case targets a closed local
 * port.
 */
describe("seed.ts entry point", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const tsxCli = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
  const seedScript = join(repoRoot, "src/infrastructure/database/seed.ts");
  const unreachableUrl = "postgresql://seed_guard_test@127.0.0.1:1/seed_guard_test";
  const tripwireDriver = "seed-guard-tripwire-not-a-driver";

  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "seed-guard-"));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function runSeed(overrides: Record<string, string>) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of [
      "NODE_ENV",
      "ALLOW_DATABASE_SEED",
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "DATABASE_DRIVER",
    ]) {
      delete env[key];
    }
    Object.assign(env, { DATABASE_URL: unreachableUrl, DATABASE_URL_UNPOOLED: unreachableUrl });
    Object.assign(env, overrides);

    const result = spawnSync(
      process.execPath,
      [tsxCli, "--tsconfig", join(repoRoot, "tsconfig.json"), seedScript],
      { cwd: workDir, env, encoding: "utf-8", timeout: 60_000 },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  function expectRefusedBeforeClientImport(output: string) {
    expect(output).toMatch(/Refusing to run the development seed script/);
    expect(output).not.toMatch(/Invalid environment configuration/);
    expect(output).not.toMatch(/Seed failed/);
    expect(output).not.toContain(unreachableUrl);
  }

  it("refuses without authorization, before importing the database client", () => {
    const { status, output } = runSeed({ DATABASE_DRIVER: tripwireDriver });
    expect(status).toBe(1);
    expectRefusedBeforeClientImport(output);
    expect(output).toMatch(/requires explicit authorization/);
  }, 60_000);

  it("refuses under NODE_ENV=production even when authorized", () => {
    const { status, output } = runSeed({
      DATABASE_DRIVER: tripwireDriver,
      ALLOW_DATABASE_SEED: "true",
      NODE_ENV: "production",
    });
    expect(status).toBe(1);
    expectRefusedBeforeClientImport(output);
    expect(output).toMatch(/NODE_ENV=production/);
  }, 60_000);

  it("ignores an authorization stored in .env.local", () => {
    writeFileSync(join(workDir, ".env.local"), "ALLOW_DATABASE_SEED=true\n");
    const { status, output } = runSeed({ DATABASE_DRIVER: tripwireDriver });
    expect(status).toBe(1);
    expectRefusedBeforeClientImport(output);
    expect(output).toMatch(/found in \.env\.local/);
  }, 60_000);

  it("with explicit authorization, proceeds to the normal seed path", () => {
    // A valid driver and a closed port: the guard passes, the client is
    // constructed, and the seed transaction fails to connect — proving
    // the normal path was reached without any real database existing.
    const { status, output } = runSeed({
      DATABASE_DRIVER: "postgres",
      ALLOW_DATABASE_SEED: "true",
    });
    expect(status).toBe(1);
    expect(output).not.toMatch(/Refusing to run/);
    expect(output).toMatch(/Seed failed \(transaction rolled back/);
  }, 60_000);
});
