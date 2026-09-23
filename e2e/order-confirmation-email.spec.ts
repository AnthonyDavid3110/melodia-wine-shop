import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Phase 11 Gate 11B: browser coverage for automatic order-confirmation
// email dispatch, driven entirely through the double-gated fake email
// provider (src/infrastructure/email/fake-test-provider.ts,
// playwright.config.ts's webServer.env E2E_FAKE_EMAIL_PROVIDER=true) —
// never the real Resend API, mirroring online-payment.spec.ts's own
// "never make the regular suite depend on an external provider"
// principle. Because the fake email provider's captured messages live
// in the webServer's own process (not this test-runner process — see
// the Gate 11B report's "E2E verification approach" discussion),
// correctness here is verified through the DB-observable
// EMAIL_SENT/EMAIL_FAILED OrderEvent rows and their `variant` metadata,
// exactly like every other OrderEvent this suite's sibling specs
// already verify directly from the shared database. Deep
// subject/HTML/text content correctness is unit/DB-tested elsewhere
// (order-confirmation-content.test.ts, order-confirmation.test.ts,
// order-confirmation-email.db.test.ts) — this file proves the real
// browser-driven integration triggers exactly the right dispatch.
config({ path: ".env.local" });

test.describe.configure({ mode: "serial" });

const { db } = await import("../src/infrastructure/database/client");
const { orders, orderItems, payments, paymentEvents, orderEvents } =
  await import("../src/infrastructure/database/schema");
const { eq, inArray, and } = await import("drizzle-orm");

function unique(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

const usedEmails: string[] = [];
function testEmail(label: string): string {
  const email = `${unique(label)}@example.test`;
  usedEmails.push(email);
  return email;
}

async function fillCustomerInfo(page: import("@playwright/test").Page, email: string) {
  await page.fill("#customerFirstName", "Marie");
  await page.fill("#customerLastName", "Confirmation");
  await page.fill("#customerAddress", "Chemin de la Confirmation 3");
  await page.fill("#customerPostalCode", "1200");
  await page.fill("#customerCity", "Genève");
  await page.fill("#customerEmail", email);
  await page.fill("#customerPhone", "022 000 00 00");
}

async function startCheckoutWithMethod(
  page: import("@playwright/test").Page,
  email: string,
  method: "TWINT" | "SELLER",
) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande", { waitUntil: "networkidle" });
  await fillCustomerInfo(page, email);
  if (method !== "SELLER") {
    await page.getByLabel(method === "TWINT" ? "TWINT" : method).click();
  }
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
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
});

test("SELLER checkout: exactly one EMAIL_SENT with the SELLER_PAYMENT variant", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("email-seller");

  await startCheckoutWithMethod(page, email, "SELLER");
  await expect(page.getByText("COMMANDE CONFIRMÉE")).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order).toBeTruthy();

  const events = await emailEventsFor(order!.id);
  expect(events).toHaveLength(1);
  expect(events[0]?.type).toBe("EMAIL_SENT");
  expect(events[0]?.metadata).toMatchObject({
    emailType: "ORDER_CONFIRMATION",
    variant: "SELLER_PAYMENT",
  });
});

test("ONLINE (TWINT) success: exactly one EMAIL_SENT with the ONLINE_PAID variant", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("email-online");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("CONFIRMED");

  const events = await emailEventsFor(order!.id);
  expect(events).toHaveLength(1);
  expect(events[0]?.type).toBe("EMAIL_SENT");
  expect(events[0]?.metadata).toMatchObject({
    emailType: "ORDER_CONFIRMATION",
    variant: "ONLINE_PAID",
  });
});

test("a cancelled online payment produces ZERO confirmation email events", async ({ page }) => {
  test.setTimeout(60000);
  const email = testEmail("email-cancelled");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));
  expect(order?.status).toBe("NEW");

  const events = await emailEventsFor(order!.id);
  expect(events).toHaveLength(0);
});

test("a repeated success callback (Return, then a duplicate notify) still produces exactly one EMAIL_SENT", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = testEmail("email-repeat");

  await startCheckoutWithMethod(page, email, "TWINT");
  await expect(page).toHaveURL(/\/test\/fake-saferpay/, { timeout: 15000 });
  await page.getByRole("button", { name: "Simulate success", exact: true }).click();
  await expect(page).toHaveURL(/\/commande\/retour/, { timeout: 15000 });
  await expect(page.getByText("Paiement confirmé", { exact: false })).toBeVisible();

  const [order] = await db.select().from(orders).where(eq(orders.customerEmail, email));

  // Fire a second, duplicate reconciliation the exact same way
  // online-payment.spec.ts's "Return then Notify" test does — a real
  // GET against the real notify route, reusing the return token.
  const returnUrl = new URL(page.url());
  const token = returnUrl.searchParams.get("rt");
  const notifyUrl = `${returnUrl.origin}/api/payments/saferpay/notify/${token}`;
  const response = await page.request.get(notifyUrl);
  expect(response.status()).toBe(200);

  const events = await emailEventsFor(order!.id);
  expect(events).toHaveLength(1);
  expect(events[0]?.type).toBe("EMAIL_SENT");
});
