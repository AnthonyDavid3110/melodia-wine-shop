import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "./support/fixtures";

// Phase 15, Gate ARCH-006-D: focused browser coverage for product image
// upload/replace/remove against the real dev server, real Server
// Actions, real database — but the FAKE storage provider
// (E2E_FAKE_STORAGE_PROVIDER=true, playwright.config.ts's webServer.env),
// so no real Vercel Blob upload ever happens here.
//
// IMPORTANT: the fake provider returns a synthetic
// `https://fake-blob.test/...` URL. That hostname is deliberately NOT
// in next.config.ts's `images.remotePatterns` (Gate ARCH-006-C only
// allowlists the two real Blob store hostnames) — these tests verify
// the form/action/storage integration (the image is validated,
// uploaded, and the resulting URL correctly persisted/replaced/
// removed), never that the public catalogue visually renders the fake
// URL through next/image. Real Vercel Blob image delivery is a
// separate, manual, Development-store-only verification, deferred
// here exactly as instructed (see the Gate ARCH-006-D report) — this
// suite must never weaken the real image allowlist just to make a fake
// URL render.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const { adminUsers, authAccounts, authSessions, authUsers, products } =
  await import("../src/infrastructure/database/schema");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");
const { eq, inArray } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const PASSWORD = "correct-horse-battery-1";
const createdAdminEmails: string[] = [];
const createdProductIds: string[] = [];

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

test.afterAll(async () => {
  if (createdProductIds.length > 0) {
    await db.delete(products).where(inArray(products.id, createdProductIds));
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
// external/untrusted file. Minimal enough to keep the suite fast.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AAA//2Q==",
  "base64",
);

test("an admin can upload a product image, see a local preview, and the association is persisted via the fake storage provider", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "image-upload");

  const name = unique("Pinot Noir E2E");
  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Catégorie").fill("RED");

  await page.getByLabel("Photo du vin").setInputFiles({
    name: "wine.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });

  // Local preview appears BEFORE any submission — proves it's a pure
  // client-side object URL, no upload has happened yet.
  await expect(page.getByAltText(/Aperçu local/)).toBeVisible();

  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const productId = page.url().split("/").pop()!;
  createdProductIds.push(productId);

  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15000 });

  const [row] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(row?.imageUrl).toMatch(/^https:\/\/fake-blob\.test\/products\/[0-9a-f-]{36}\.jpg$/);

  // "Image actuelle" and the remove button now appear on re-navigation.
  await page.reload();
  await expect(page.getByText("Image actuelle")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).toBeVisible({
    timeout: 15000,
  });
});

test("an admin can replace an existing product image", async ({ page }) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "image-replace");

  const name = unique("Gamaret E2E");
  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Catégorie").fill("RED");
  await page.getByLabel("Photo du vin").setInputFiles({
    name: "wine.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const productId = page.url().split("/").pop()!;
  createdProductIds.push(productId);

  const [originalRow] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  const originalUrl = originalRow?.imageUrl;
  expect(originalUrl).toBeTruthy();

  await page.getByLabel("Photo du vin").setInputFiles({
    name: "replacement.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Produit enregistré.")).toBeVisible({ timeout: 15000 });

  const [updatedRow] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(updatedRow?.imageUrl).toMatch(/^https:\/\/fake-blob\.test\/products\/[0-9a-f-]{36}\.jpg$/);
  expect(updatedRow?.imageUrl).not.toBe(originalUrl);
});

test("an admin can remove a product image via the confirmation dialog, cancelling first changes nothing", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "image-remove");

  const name = unique("Merlot E2E");
  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Catégorie").fill("RED");
  await page.getByLabel("Photo du vin").setInputFiles({
    name: "wine.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const productId = page.url().split("/").pop()!;
  createdProductIds.push(productId);

  await page.reload();
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).toBeVisible({
    timeout: 15000,
  });

  // Opening the dialog and cancelling must not remove the image —
  // same `getByRole("dialog")` scoping convention already proven in
  // admin-catalog.spec.ts/admin-orders.spec.ts.
  await page.getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Retour" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  const [stillPresentRow] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(stillPresentRow?.imageUrl).toBeTruthy();

  // Confirming actually removes it.
  await page.getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer l’image" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });

  const [removedRow] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(removedRow?.imageUrl).toBeNull();

  await page.reload();
  await expect(page.getByText("Image actuelle")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer l’image" })).not.toBeVisible();
});

test("creating a product without an image works normally, and editing without a new file preserves no-image state", async ({
  page,
}) => {
  test.setTimeout(60000);
  await createAndLogInAsAdmin(page, "no-image");

  const name = unique("Chardonnay E2E");
  await page.goto("/admin/produits/nouveau");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Catégorie").fill("WHITE");
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/produits\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const productId = page.url().split("/").pop()!;
  createdProductIds.push(productId);

  const [row] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(row?.imageUrl).toBeNull();

  await page.getByLabel("Nom").fill(`${name} — modifié`);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Produit enregistré.")).toBeVisible({ timeout: 15000 });

  const [stillNullRow] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, productId));
  expect(stillNullRow?.imageUrl).toBeNull();
});
