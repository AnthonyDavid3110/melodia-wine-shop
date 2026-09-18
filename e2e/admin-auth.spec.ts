import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 3 Gate 2B: focused browser coverage for the real admin
// login/logout flow, against the same local Postgres the dev server
// (started by playwright.config.ts's webServer) uses. Deliberately not
// a large suite — see the Gate 2B report for what's covered and why.
//
// This test file runs as its own Node process (not through Next.js), so
// — exactly like src/infrastructure/database/seed.ts and
// bootstrap-admin.ts — .env.local must be loaded before importing
// anything that constructs the database client, via dynamic import
// after config() (ESM evaluates static imports before this file's own
// top-level code).
config({ path: ".env.local" });

// Unlike the other e2e specs, these tests create/mutate real Better
// Auth identities via direct DB writes outside any per-test transaction
// (the shared `db` singleton is also used live by the dev server these
// tests drive a browser against) — running several of these tests
// fully in parallel raced against each other for real (observed: a
// concurrent sign-in's session insert hit a FK violation because a
// same-worker-adjacent test's identity was still mid-setup/teardown).
// Serial execution avoids that; this suite is small enough that it
// costs little.
test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const { adminUsers, authAccounts, authSessions, authUsers } =
  await import("../src/infrastructure/database/schema");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");
const { eq } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const PASSWORD = "correct-horse-battery-1";
const createdEmails: string[] = [];

async function createTestAdmin(label: string, { active = true }: { active?: boolean } = {}) {
  const email = `${unique(label)}@example.test`;
  createdEmails.push(email);
  const { adminId } = await bootstrapAdmin({ email, name: `E2E ${label}`, password: PASSWORD });
  if (!active) {
    await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, adminId));
  }
  return { email, password: PASSWORD };
}

test.afterAll(async () => {
  for (const email of createdEmails) {
    await db.delete(adminUsers).where(eq(adminUsers.email, email));
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));
    if (authUser) {
      await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
      await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
    }
  }
});

test("/admin/connexion is reachable without authentication", async ({ page }) => {
  await page.goto("/admin/connexion");
  await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

test("anonymous GET /admin is redirected away, never showing protected content", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/connexion/);
  await expect(page.getByText("Espace protégé")).not.toBeVisible();
});

test("a forged session cookie does not grant access — the DAL, not Proxy, is authoritative", async ({
  page,
  context,
}) => {
  // Proxy (src/proxy.ts) only checks that a cookie of this name is
  // *present* before letting a request through to the page. A forged,
  // syntactically-plausible value passes that check but corresponds to
  // no real auth_sessions row, so requireAdmin() must still reject it —
  // proving Proxy is not the actual authorization boundary.
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged-token-value.not-a-real-signature",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/connexion/);
  await expect(page.getByText("Espace protégé")).not.toBeVisible();
});

test("public sign-up remains unavailable", async ({ request }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "Nobody", email: `${unique("no-signup")}@example.test`, password: PASSWORD },
  });
  expect(response.ok()).toBe(false);
});

test("an active linked admin can log in and reach protected admin functionality", async ({
  page,
}) => {
  const { email, password } = await createTestAdmin("active-login");

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Espace protégé")).toBeVisible();
});

test("an inactive linked admin authenticates but cannot reach protected admin functionality", async ({
  page,
}) => {
  // Better Auth's own sign-in has no knowledge of admin_users.active — it
  // only checks its own auth_users/auth_accounts, so this login itself
  // succeeds. The domain-level `active` check in requireAdmin() is what
  // must then deny access — this test isolates exactly that boundary.
  const { email, password } = await createTestAdmin("inactive-login", { active: false });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/admin\/connexion/);
  await expect(page.getByText("Espace protégé")).not.toBeVisible();
});

test("logout invalidates the session — /admin is no longer reachable afterward", async ({
  page,
}) => {
  const { email, password } = await createTestAdmin("logout-flow");

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/admin\/connexion/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/connexion/);
});

test("the login error is identical for an unknown email and a wrong password", async ({ page }) => {
  const { email } = await createTestAdmin("enumeration-check");

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  const wrongPasswordError = await page.getByTestId("login-error").textContent();

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(`${unique("nonexistent")}@example.test`);
  await page.getByLabel("Mot de passe").fill("any-password-at-all");
  await page.getByRole("button", { name: "Se connecter" }).click();
  const unknownEmailError = await page.getByTestId("login-error").textContent();

  expect(wrongPasswordError).toBeTruthy();
  expect(wrongPasswordError).toBe(unknownEmailError);
});
