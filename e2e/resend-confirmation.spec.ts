import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 11 Gate 11C: browser coverage for the admin manual resend
// action, driven entirely through the double-gated fake email provider
// (E2E_FAKE_EMAIL_PROVIDER=true, playwright.config.ts's webServer.env)
// — never the real Resend API, mirroring
// order-confirmation-email.spec.ts's Gate 11B principle. Correctness is
// verified through the same DB-observable EMAIL_SENT/EMAIL_FAILED
// OrderEvent rows + variant/trigger metadata other specs already use.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const {
  orders,
  orderItems,
  payments,
  paymentEvents,
  orderEvents,
  adminUsers,
  authUsers,
  authSessions,
  authAccounts,
} = await import("../src/infrastructure/database/schema");
const { eq, inArray, and } = await import("drizzle-orm");
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

async function fillCustomerInfo(page: import("@playwright/test").Page, email: string) {
  await page.fill("#customerFirstName", "Claire");
  await page.fill("#customerLastName", "Renvoi");
  await page.fill("#customerAddress", "Avenue du Renvoi 4");
  await page.fill("#customerPostalCode", "1950");
  await page.fill("#customerCity", "Sion");
  await page.fill("#customerEmail", email);
  await page.fill("#customerPhone", "027 000 00 00");
}

async function emailEventsFor(orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(
      and(
        inArray(orderEvents.type, ["EMAIL_SENT", "EMAIL_FAILED"]),
        eq(orderEvents.orderId, orderId),
      ),
    );
}

test.afterAll(async () => {
  if (usedEmails.length > 0) {
    const matchingOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerEmail, usedEmails));
    const orderIds = matchingOrders.map((o) => o.id);
    if (orderIds.length > 0) {
      const orderPayments = await db
        .select({ id: payments.id })
        .from(payments)
        .where(inArray(payments.orderId, orderIds));
      const paymentIds = orderPayments.map((p) => p.id);
      if (paymentIds.length > 0) {
        await db.delete(paymentEvents).where(inArray(paymentEvents.paymentId, paymentIds));
      }
      await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
      await db.delete(payments).where(inArray(payments.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
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

test("eligible public SELLER order: admin resends, sees success feedback, history shows the manual entry", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("resend-seller");

  // Real public checkout — seller payment (default method).
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande", { waitUntil: "networkidle" });
  await fillCustomerInfo(page, email);
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByText("COMMANDE CONFIRMÉE")).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order).toBeTruthy();

  await createAndLogInAsTestAdmin(page, "resend-seller-admin");
  await page.goto(`/admin/commandes/${order!.id}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Renvoyer la confirmation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(email)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Renvoyer la confirmation" }).click();

  await expect(page.getByText("E-mail de confirmation envoyé.")).toBeVisible({ timeout: 15000 });

  const events = await emailEventsFor(order!.id);
  const manual = events.filter(
    (e) =>
      e.type === "EMAIL_SENT" && (e.metadata as { trigger?: string })?.trigger === "ADMIN_RESEND",
  );
  expect(manual).toHaveLength(1);
  expect((manual[0]?.metadata as { variant?: string })?.variant).toBe("SELLER_PAYMENT");

  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByText("Confirmation renvoyée manuellement")).toBeVisible();
});

test("eligible ONLINE_PAID order: admin resends successfully", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("resend-online");

  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande", { waitUntil: "networkidle" });
  await fillCustomerInfo(page, email);
  await page.getByLabel("TWINT").click();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.customerPaymentStatus).toBe("PAID");

  await createAndLogInAsTestAdmin(page, "resend-online-admin");
  await page.goto(`/admin/commandes/${order!.id}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Renvoyer la confirmation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Renvoyer la confirmation" }).click();
  await expect(page.getByText("E-mail de confirmation envoyé.")).toBeVisible({ timeout: 15000 });

  const events = await emailEventsFor(order!.id);
  const manual = events.filter(
    (e) =>
      e.type === "EMAIL_SENT" && (e.metadata as { trigger?: string })?.trigger === "ADMIN_RESEND",
  );
  expect(manual).toHaveLength(1);
  expect((manual[0]?.metadata as { variant?: string })?.variant).toBe("ONLINE_PAID");
});

test("ineligible order (online payment still pending): no resend button, no misleading confirmation possible", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("resend-ineligible");

  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande", { waitUntil: "networkidle" });
  await fillCustomerInfo(page, email);
  await page.getByLabel("TWINT").click();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  // Deliberately abandon the payment here — never resolve it — leaving
  // the order NEW/PENDING, exactly the ineligible case under test.

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("NEW");

  await createAndLogInAsTestAdmin(page, "resend-ineligible-admin");
  await page.goto(`/admin/commandes/${order!.id}`, { waitUntil: "networkidle" });

  await expect(page.getByRole("button", { name: "Renvoyer la confirmation" })).not.toBeVisible();
  await expect(
    page.getByText("Le paiement en ligne n'a pas encore été confirmé", { exact: false }),
  ).toBeVisible();

  const events = await emailEventsFor(order!.id);
  expect(events).toHaveLength(0);
});
