import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Gate 2B bootstrap security review: proves, by inspecting source
 * rather than trusting a description, that the disableSignUp=false
 * Better Auth instance used by bootstrap-admin-core.ts is structurally
 * unreachable from any HTTP-facing code path. Pure source-text checks
 * (no imports of the auth stack itself) so this runs under `pnpm test`
 * without a database or environment variables.
 */

const ROUTE_FILE = "src/app/api/auth/[...all]/route.ts";
const SERVER_FILE = "src/infrastructure/auth/server.ts";
const CONFIG_FILE = "src/infrastructure/auth/config.ts";
const BOOTSTRAP_CORE_FILE = "src/infrastructure/auth/bootstrap-admin-core.ts";
const OTHER_AUTH_INFRA_FILES = ["server.ts", "config.ts", "schema-map.ts", "disable-admin.ts"];

describe("the bootstrap-only Better Auth instance is not reachable via HTTP", () => {
  it("the Next.js catch-all auth route only ever imports the deployed server instance", () => {
    const source = readFileSync(ROUTE_FILE, "utf-8");
    expect(source).not.toMatch(/bootstrap/i);
    expect(source).toContain('from "@/infrastructure/auth/server"');
  });

  it("the deployed app's auth instance (server.ts) has no import statement referencing the bootstrap module", () => {
    const source = readFileSync(SERVER_FILE, "utf-8");
    expect(source).not.toMatch(/from\s+["'].*bootstrap/i);
    expect(source).toContain("betterAuth(createAuthConfig())");
  });

  it("createAuthConfig defaults disableSignUp to true and its override is a plain static object parameter", () => {
    const source = readFileSync(CONFIG_FILE, "utf-8");
    expect(source).toMatch(/disableSignUp:\s*true/);
    expect(source).toMatch(/export function createAuthConfig\(\s*overrides\?:/);
    // The parameter type is a plain data shape (Partial<...emailAndPassword>),
    // never Request/Headers/NextRequest — i.e. nothing here can be driven
    // by an incoming HTTP call.
    expect(source).not.toMatch(/overrides.*:.*(Request|Headers|NextRequest)/);
  });

  it("only bootstrap-admin-core.ts ever overrides disableSignUp to false", () => {
    const bootstrapSource = readFileSync(BOOTSTRAP_CORE_FILE, "utf-8");
    expect(bootstrapSource).toContain("disableSignUp: false");

    for (const file of OTHER_AUTH_INFRA_FILES) {
      const contents = readFileSync(`src/infrastructure/auth/${file}`, "utf-8");
      expect(contents).not.toContain("disableSignUp: false");
    }
  });

  it("bootstrap-admin-core.ts is never imported by anything under src/app (no route can reach it)", () => {
    // A simple grep over the one directory that can expose
    // HTTP-reachable code in this Next.js App Router project.
    const matches = execSync('grep -rl "bootstrap-admin-core" src/app || true', {
      encoding: "utf-8",
    }).trim();
    expect(matches).toBe("");
  });
});
