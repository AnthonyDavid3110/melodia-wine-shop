import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "./support/fixtures";

// Phase 15, Gate ARCH-006-E: focused browser coverage for bundle image
// upload/replace/remove against the real dev server, real Server
// Actions, real database — but the FAKE storage provider
// (E2E_FAKE_STORAGE_PROVIDER=true, playwright.config.ts's webServer.env),
// so no real Vercel Blob upload ever happens here. Direct mirror of
// e2e/product-image-upload.spec.ts (Gate ARCH-006-D), adapted for
// bundles' campaign-scoped routes.
//
// IMPORTANT: the fake provider returns a synthetic
// `https://fake-blob.test/...` URL. That hostname is deliberately NOT
// in next.config.ts's `images.remotePatterns` (Gate ARCH-006-C only
// allowlists the two real Blob store hostnames) — these tests verify
// the form/action/storage integration, never that the public catalogue
// visually renders the fake URL through next/image. Real Vercel Blob
// image delivery is a separate, manual, Development-store-only
// verification, deferred here exactly as instructed — this suite must
// never weaken the real image allowlist just to make a fake URL
// render.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const { adminUsers, authAccounts, authSessions, authUsers, bundles, campaigns } =
  await import("../src/infrastructure/database/schema");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");
const { eq, inArray } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const PASSWORD = "correct-horse-battery-1";
const createdAdminEmails: string[] = [];
const createdCampaignIds: string[] = [];

async function createAndLogInAsAdmin(page: import("@playwright/test").Page, label: string) {
  const email = `${unique(label)}@example.test`;
  createdAdminEmails.push(email);
  await bootstrapAdmin({ email, name: `E2E ${label}`, password: PASSWORD });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
}

/** Every bundle belongs to a campaign — creates a fresh, never-activated one per test (Gate 2B isolation rule), returning its id. Bundles cascade-delete with the campaign (RESTRICT means the campaign can't be deleted while a bundle still references it, so bundles are deleted first). */
async function createCampaignViaUi(page: import("@playwright/test").Page, label: string) {
  await page.goto("/admin/campagne/nouveau");
  await page.getByLabel("Nom").fill(unique(label));
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(page).toHaveURL(/\/admin\/campagne\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const campaignId = page.url().split("/").pop()!;
  createdCampaignIds.push(campaignId);
  return campaignId;
}

test.afterAll(async () => {
  if (createdCampaignIds.length > 0) {
    await db.delete(bundles).where(inArray(bundles.campaignId, createdCampaignIds));
    await db.delete(campaigns).where(inArray(campaigns.id, createdCampaignIds));
  }
  for (const email of createdAdminEmails) {
    await db.delete(adminUsers).where(eq(adminUsers.email, email));
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email));
    if (authUser) {
      await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
      await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
    }
  }
});

// A real, tiny, valid 4x4 JPEG — generated once and reused, never an
// external/untrusted file. Minimal enough to keep most of the suite fast.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AAA//2Q==",
  "base64",
);

/**
 * A realistically-sized JPEG (real photo dimensions, random noise so it
 * doesn't compress away to almost nothing, like an actual phone photo)
 * — generated in-process via `sharp`, never an external/untrusted
 * file. Same regression purpose as `product-image-upload.spec.ts`'s
 * own copy: Next.js's default 1 MB Server Action body limit (far below
 * this app's 5 MiB upload policy) was never exercised by any
 * automated test using tiny fixtures and went unnoticed until a real
 * admin hit it in practice (Gate ARCH-006-D hotfix).
 */
const { default: sharp } = await import("sharp");
const REALISTIC_JPEG = await (async () => {
  const width = 3000;
  const height = 2000;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
})();

test("an admin can upload a bundle image, see a local preview, and the association is persisted via the fake storage provider", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "bundle-image-upload");
  const campaignId = await createCampaignViaUi(page, "Campagne image carton");

  const name = unique("Carton E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");

  await page.getByLabel("Photo du carton").setInputFiles({
    name: "carton.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });

  // Local preview appears BEFORE any submission — proves it's a pure
  // client-side object URL, no upload has happened yet.
  await expect(page.getByAltText(/Aperçu local/)).toBeVisible();

  await page.getByRole("button", { name: "Créer le carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const bundleId = page.url().split("/").pop()!;

  const [row] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(row?.imageUrl).toMatch(/^https:\/\/fake-blob\.test\/bundles\/[0-9a-f-]{36}\.jpg$/);

  // "Image actuelle" and the remove button now appear on re-navigation.
  await page.reload();
  await expect(page.getByText("Image actuelle")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).toBeVisible({
    timeout: 15000,
  });
});

test("a realistically-sized photo (several MB, within the 5 MiB policy) uploads successfully — regression test for Next's default 1 MB Server Action body limit", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect(REALISTIC_JPEG.byteLength).toBeGreaterThan(1024 * 1024);
  expect(REALISTIC_JPEG.byteLength).toBeLessThan(5 * 1024 * 1024);

  await createAndLogInAsAdmin(page, "bundle-image-realistic");
  const campaignId = await createCampaignViaUi(page, "Campagne photo realiste");

  const name = unique("Carton Realiste E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByLabel("Photo du carton").setInputFiles({
    name: "realistic-photo.jpg",
    mimeType: "image/jpeg",
    buffer: REALISTIC_JPEG,
  });

  await page.getByRole("button", { name: "Créer le carton" }).click();
  // Without next.config.ts's experimental.serverActions.bodySizeLimit
  // raised above Next's 1 MB default, this request fails with a raw
  // 413 "Body exceeded 1 MB limit" crash.
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const bundleId = page.url().split("/").pop()!;

  const [row] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(row?.imageUrl).toMatch(/^https:\/\/fake-blob\.test\/bundles\/[0-9a-f-]{36}\.jpg$/);
});

test("a file over the 5 MiB policy is rejected with a clear validation error, never a raw transport-layer crash", async ({
  page,
}) => {
  test.setTimeout(60000);
  const oversized = Buffer.concat([REALISTIC_JPEG, Buffer.alloc(300 * 1024, 0)]);
  expect(oversized.byteLength).toBeGreaterThan(5 * 1024 * 1024);
  expect(oversized.byteLength).toBeLessThan(6 * 1024 * 1024);

  await createAndLogInAsAdmin(page, "bundle-image-oversized");
  const campaignId = await createCampaignViaUi(page, "Campagne photo trop grande");

  const name = unique("Carton Trop Grand E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByLabel("Photo du carton").setInputFiles({
    name: "oversized.jpg",
    mimeType: "image/jpeg",
    buffer: oversized,
  });

  await page.getByRole("button", { name: "Créer le carton" }).click();
  // Stays on the form with the app's own clear French error — proves
  // the raised transport ceiling (6mb) is wide enough to let this
  // request reach application code, where the 5 MiB policy correctly
  // rejects it, rather than Next's own generic 413 crash intercepting
  // it first.
  await expect(page.getByText(/dépasse la taille maximale de 5 Mo/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page).toHaveURL(`/admin/campagne/${campaignId}/bundles/nouveau`);
});

test("an admin can replace an existing bundle image", async ({ page }) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "bundle-image-replace");
  const campaignId = await createCampaignViaUi(page, "Campagne remplacement image");

  const name = unique("Carton Remplace E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByLabel("Photo du carton").setInputFiles({
    name: "carton.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Créer le carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const bundleId = page.url().split("/").pop()!;

  const [originalRow] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  const originalUrl = originalRow?.imageUrl;
  expect(originalUrl).toBeTruthy();

  await page.getByLabel("Photo du carton").setInputFiles({
    name: "replacement.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Carton enregistré.")).toBeVisible({ timeout: 15000 });

  const [updatedRow] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(updatedRow?.imageUrl).toMatch(/^https:\/\/fake-blob\.test\/bundles\/[0-9a-f-]{36}\.jpg$/);
  expect(updatedRow?.imageUrl).not.toBe(originalUrl);
});

test("an admin can remove a bundle image via the confirmation dialog, cancelling first changes nothing", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "bundle-image-remove");
  const campaignId = await createCampaignViaUi(page, "Campagne suppression image");

  const name = unique("Carton Suppression E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByLabel("Photo du carton").setInputFiles({
    name: "carton.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Créer le carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const bundleId = page.url().split("/").pop()!;

  await page.reload();
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).toBeVisible({
    timeout: 15000,
  });

  // Opening the dialog and cancelling must not remove the image — same
  // `getByRole("dialog")` scoping convention already proven in
  // admin-catalog.spec.ts/product-image-upload.spec.ts.
  await page.getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Retour" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  const [stillPresentRow] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(stillPresentRow?.imageUrl).toBeTruthy();

  // Confirming actually removes it.
  await page.getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });

  const [removedRow] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(removedRow?.imageUrl).toBeNull();

  await page.reload();
  await expect(page.getByText("Image actuelle")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).not.toBeVisible();
});

test("creating a bundle without an image works normally, and editing without a new file preserves no-image state", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "bundle-no-image");
  const campaignId = await createCampaignViaUi(page, "Campagne sans image");

  const name = unique("Carton Sans Image E2E");
  await page.goto(`/admin/campagne/${campaignId}/bundles/nouveau`);
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Prix (CHF)").fill("30.00");
  await page.getByRole("button", { name: "Créer le carton" }).click();
  await expect(page).toHaveURL(/\/bundles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const bundleId = page.url().split("/").pop()!;

  const [row] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(row?.imageUrl).toBeNull();

  await page.getByLabel("Nom").fill(`${name} — modifié`);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Carton enregistré.")).toBeVisible({ timeout: 15000 });

  const [stillNullRow] = await db
    .select({ imageUrl: bundles.imageUrl })
    .from(bundles)
    .where(eq(bundles.id, bundleId));
  expect(stillNullRow?.imageUrl).toBeNull();
});
