import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 12 Gate 12A: browser coverage for the authenticated admin CSV
// exports (`/admin/exports`). Verifies the download boundary
// (authenticated 200 vs unauthenticated 401, headers, BOM/delimiter,
// accented-content round-trip, cancelled-order inclusion) against the
// shared seeded ACTIVE campaign real fixture orders — mirroring
// admin-orders.spec.ts's own "manual order creation through the real
// admin core, cleaned up in afterAll" approach. Deep column/escaping/
// aggregation correctness is unit/DB-tested elsewhere
// (src/domain/csv/*.test.ts, exports.db.test.ts) — this file proves
// the real authenticated download path end to end.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  orders,
  orderItems,
  payments,
  orderEvents,
  adminUsers,
  authUsers,
  authSessions,
  authAccounts,
} = await import("../src/infrastructure/database/schema");
const { eq, inArray } = await import("drizzle-orm");
const { bootstrapAdmin } = await import("../src/infrastructure/auth/bootstrap-admin-core");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const usedEmails: string[] = [];
function testEmail(label: string): string {
  const email = `${unique(label)}@example.test`;
  usedEmails.push(email);
  return email;
}

const createdAdminEmails: string[] = [];

async function createAndLogInAsTestAdmin(page: import("@playwright/test").Page, label: string) {
  const email = `${unique(label)}@example.test`;
  createdAdminEmails.push(email);
  await bootstrapAdmin({ email, name: `E2E ${label}`, password: "correct-horse-battery-1" });

  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("correct-horse-battery-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
}

/** RFC 4180-ish split good enough for these fixtures (no embedded delimiters in the test data). */
function splitCsvBody(body: string): { header: string[]; rows: string[][] } {
  const withoutBom = body.startsWith("﻿") ? body.slice(1) : body;
  const lines = withoutBom.split("\r\n").filter((line) => line.length > 0);
  const [header, ...rest] = lines.map((line) => line.split(";"));
  return { header: header ?? [], rows: rest };
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(payments).where(inArray(payments.orderId, orderIds));
      await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
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

test("admin sees all four export actions on /admin/exports", async ({ page }) => {
  await createAndLogInAsTestAdmin(page, "exports-list");
  await page.goto("/admin/exports", { waitUntil: "networkidle" });

  await expect(page.getByRole("link", { name: "Télécharger" })).toHaveCount(4);
  await expect(page.getByText("Commandes (CSV)")).toBeVisible();
  await expect(page.getByText("Lignes de commande (CSV)")).toBeVisible();
  await expect(page.getByText("Ventes par vendeur (CSV)")).toBeVisible();
  await expect(page.getByText("Besoins en vin (CSV)")).toBeVisible();
});

test("orders.csv and order-items.csv include a manual order, its accented customer name, and its CANCELLED status once cancelled", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("export-manual");

  await createAndLogInAsTestAdmin(page, "exports-manual-admin");

  await page.goto("/admin/commandes/nouvelle", { waitUntil: "networkidle" });
  await page.fill("#m-customerFirstName", "Amélie");
  await page.fill("#m-customerLastName", "Müller-Genève");
  await page.fill("#m-customerAddress", "Chemin des Vignes 9");
  await page.fill("#m-customerPostalCode", "1204");
  await page.fill("#m-customerCity", "Genève");
  await page.fill("#m-customerEmail", email);
  await page.fill("#m-customerPhone", "+41 22 000 00 00");
  await page
    .getByRole("button", { name: /Augmenter la quantité/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(/\/admin\/commandes\/(?!nouvelle$)[^/]+$/, { timeout: 20000 });

  const url = page.url();
  const orderId = url.split("/admin/commandes/")[1]!.split(/[?#]/)[0]!;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  expect(order).toBeTruthy();
  const orderNumber = order!.orderNumber;

  // --- orders.csv: present, unassigned, correct accented name ---
  const ordersCsvResponse = await page.request.get(
    `/admin/exports/orders.csv?campaign=${order!.campaignId}`,
  );
  expect(ordersCsvResponse.status()).toBe(200);
  expect(ordersCsvResponse.headers()["content-type"]).toContain("text/csv");
  expect(ordersCsvResponse.headers()["content-disposition"]).toContain("attachment");
  expect(ordersCsvResponse.headers()["content-disposition"]).toMatch(
    /commandes-\d{4}-\d{2}-\d{2}\.csv/,
  );
  expect(ordersCsvResponse.headers()["cache-control"]).toContain("no-store");

  const ordersCsvBody = await ordersCsvResponse.text();
  expect(ordersCsvBody.charCodeAt(0)).toBe(0xfeff);
  const { header: ordersHeader, rows: ordersRows } = splitCsvBody(ordersCsvBody);
  expect(ordersHeader[0]).toBe("numeroCommande");
  const orderRow = ordersRows.find((row) => row[0] === orderNumber);
  expect(orderRow).toBeDefined();
  expect(orderRow![4]).toBe("Amélie Müller-Genève");
  expect(orderRow![11]).toBe("Non attribuée");
  expect(orderRow![3]).toBe("Confirmée");
  // The leading `+` is a formula-injection trigger character (approved
  // Step 1 §3), so the phone is apostrophe-prefixed — the digits/
  // spacing after the marker stay fully intact.
  expect(orderRow![9]).toBe("'+41 22 000 00 00");

  // --- order-items.csv: present, joinable via orderNumber, no UUID ---
  const itemsCsvResponse = await page.request.get(
    `/admin/exports/order-items.csv?campaign=${order!.campaignId}`,
  );
  expect(itemsCsvResponse.status()).toBe(200);
  const itemsCsvBody = await itemsCsvResponse.text();
  expect(itemsCsvBody).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const { rows: itemRows } = splitCsvBody(itemsCsvBody);
  const matchingItemRows = itemRows.filter((row) => row[0] === orderNumber);
  expect(matchingItemRows.length).toBeGreaterThan(0);
  expect(matchingItemRows[0]![1]).toBe("Confirmée");

  // --- cancel it, then re-check both exports show it as CANCELLED / Annulée ---
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();

  const ordersCsvAfterCancel = await page.request.get(
    `/admin/exports/orders.csv?campaign=${order!.campaignId}`,
  );
  const { rows: rowsAfterCancel } = splitCsvBody(await ordersCsvAfterCancel.text());
  const cancelledOrderRow = rowsAfterCancel.find((row) => row[0] === orderNumber);
  expect(cancelledOrderRow).toBeDefined();
  expect(cancelledOrderRow![3]).toBe("Annulée");
  expect(cancelledOrderRow![4]).toBe("Amélie Müller-Genève");

  const itemsCsvAfterCancel = await page.request.get(
    `/admin/exports/order-items.csv?campaign=${order!.campaignId}`,
  );
  const { rows: itemRowsAfterCancel } = splitCsvBody(await itemsCsvAfterCancel.text());
  const cancelledItemRows = itemRowsAfterCancel.filter((row) => row[0] === orderNumber);
  expect(cancelledItemRows.length).toBeGreaterThan(0);
  expect(cancelledItemRows[0]![1]).toBe("Annulée");
});

test("seller-sales.csv and wine-requirements.csv download successfully with the expected headers", async ({
  page,
}) => {
  await createAndLogInAsTestAdmin(page, "exports-other-admin");
  await page.goto("/admin/exports", { waitUntil: "networkidle" });

  const sellerSalesResponse = await page.request.get(
    page.url().replace("/admin/exports", "/admin/exports/seller-sales.csv"),
  );
  expect(sellerSalesResponse.status()).toBe(200);
  expect(sellerSalesResponse.headers()["content-type"]).toContain("text/csv");
  const { header: sellerSalesHeader } = splitCsvBody(await sellerSalesResponse.text());
  expect(sellerSalesHeader[0]).toBe("vendeur");

  const wineRequirementsResponse = await page.request.get(
    page.url().replace("/admin/exports", "/admin/exports/wine-requirements.csv"),
  );
  expect(wineRequirementsResponse.status()).toBe(200);
  const { header: wineHeader } = splitCsvBody(await wineRequirementsResponse.text());
  expect(wineHeader).toEqual(["vin", "bouteilles", "cartons", "bouteillesRestantes"]);
});

test("an unauthenticated request cannot retrieve any export", async ({ browser }) => {
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  // The Proxy (optimistic, cookie-presence-only) is the first thing a
  // real anonymous browser hits — it redirects to /admin/connexion
  // before the Route Handler's own requireAdmin()/getAdminOrNull()
  // check ever runs, exactly like every other /admin/* page (never
  // followed here, so the raw redirect itself is observable).
  const redirectResponse = await anonymousPage.request.get("/admin/exports/orders.csv", {
    maxRedirects: 0,
  });
  expect(redirectResponse.status()).toBe(307);
  expect(redirectResponse.headers()["location"]).toContain("/admin/connexion");

  // Following the redirect (what a real browser does) must land on the
  // login page — never CSV content — confirming no data is retrievable
  // by an unauthenticated caller through either layer.
  const followedResponse = await anonymousPage.request.get("/admin/exports/orders.csv");
  expect(followedResponse.headers()["content-type"]).not.toContain("text/csv");
  const body = await followedResponse.text();
  expect(body).not.toContain("numeroCommande");

  await anonymousContext.close();
});

test("a forged session cookie does not grant access — the Route Handler's own auth check, not the Proxy, is authoritative", async ({
  browser,
}) => {
  // Mirrors admin-auth.spec.ts's own "forged cookie" test: the Proxy
  // only checks cookie *presence* before letting the request through —
  // a forged-but-present cookie passes that optimistic check, so this
  // exercises the Route Handler's own getAdminOrNull() independently.
  const forgedContext = await browser.newContext();
  await forgedContext.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged-token-value.not-a-real-signature",
      url: "http://localhost:3000",
    },
  ]);
  const forgedPage = await forgedContext.newPage();

  const response = await forgedPage.request.get("/admin/exports/orders.csv", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
  const body = await response.text();
  expect(body).not.toContain("numeroCommande");

  await forgedContext.close();
});
