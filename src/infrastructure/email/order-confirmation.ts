import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
// Type-only — nothing in this module touches the real `db` value, only
// its shape (`EventDbHandle` / the `Pick<typeof db, "select">`
// parameter types below). A value import would make this module
// require a live DATABASE_URL just to load (see `client.ts`'s eager
// module-level check), which would break importing it from a plain
// (non-DB) unit test — exactly the hazard already documented for
// `online-payments.ts` in
// `src/app/api/payments/saferpay/notify/[token]/route.test.ts`. Every
// caller (create-order.ts, online-payments.ts, the Gate 11C admin
// action) passes its own already-live `dbHandle` explicitly — no
// function here ever defaults one.
import type { db } from "../database/client";
import { orderEvents, sellers } from "../database/schema";
import * as resendProvider from "./resend-provider";
import * as fakeTestProvider from "./fake-test-provider";
import {
  EmailConfigurationError,
  EmailNetworkError,
  EmailProviderRejectedError,
} from "./resend-provider";
import type { EmailProvider, SendEmailSuccess } from "./email-provider";
import {
  buildOrderConfirmationEmail,
  type OrderConfirmationEmailInput,
} from "@/domain/email/order-confirmation-content";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import {
  resolveOrderConfirmationEligibility,
  type ConfirmationEligibilityPaymentInput,
  type ConfirmationEligibilityReason,
} from "@/domain/email/resolve-confirmation-eligibility";

/**
 * Double-gated test-provider seam (Phase 11 Gate 11A) — mirrors
 * `src/infrastructure/payments/online-payments.ts`'s `getProvider()`
 * exactly. The fake provider is selected only when BOTH
 * `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_EMAIL_PROVIDER=true` opt-in are true — intended to be set
 * only in `playwright.config.ts`'s own `webServer.env`, once Gate 11B
 * adds Playwright coverage of actual dispatch, never in
 * `.env.example` or any real deployment configuration. Even a mistaken
 * production env var alone can never activate it. The return type
 * (`EmailProvider`) structurally forces both `resendProvider` and
 * `fakeTestProvider` to satisfy the same shape.
 */
function getProvider(): EmailProvider {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_EMAIL_PROVIDER === "true") {
    return fakeTestProvider;
  }
  return resendProvider;
}

/**
 * Minimal structural shapes (mirroring `payment-guards.ts`'s/
 * `order-guards.ts`'s narrow `Pick`-style input interfaces) — every
 * caller's real Drizzle row type is a structural superset, so no cast
 * is needed at any call site.
 */
export interface PersistedOrderForConfirmation {
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  deliveryNote: string | null;
  totalAmount: number;
  sellerId: string | null;
}

export interface PersistedOrderItemForConfirmation {
  nameSnapshot: string;
  quantity: number;
  lineTotalAmount: number;
}

/**
 * Gate 11C — the ONE place persisted order/items/seller data becomes an
 * `OrderConfirmationEmailInput`. Extracted from what were, until this
 * gate, two independent copies of the same object-construction logic in
 * `create-order.ts` and `online-payments.ts` (both now delegate here —
 * see their own call sites for what each still fetches locally). Reused
 * a third time by `resendOrderConfirmation()` below. No behavior change
 * to either Gate 11B call site: same fields, same seller-name
 * resolution (never fabricated when unassigned — docs/03-USER-FLOWS.md
 * §17).
 */
export async function buildOrderConfirmationEmailInput(
  dbHandle: Pick<typeof db, "select">,
  order: PersistedOrderForConfirmation,
  items: ReadonlyArray<PersistedOrderItemForConfirmation>,
  paymentMethod: "SELLER" | "TWINT" | "CARD",
): Promise<OrderConfirmationEmailInput> {
  let sellerName: string | null = null;
  if (order.sellerId) {
    const [seller] = await dbHandle.select().from(sellers).where(eq(sellers.id, order.sellerId));
    if (seller) {
      sellerName = formatSellerName(seller);
    }
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      customerAddress: order.customerAddress,
      customerPostalCode: order.customerPostalCode,
      customerCity: order.customerCity,
      deliveryNote: order.deliveryNote,
      totalAmount: order.totalAmount,
    },
    items: items.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
    })),
    paymentMethod,
    sellerName,
  };
}

/**
 * The one composed entry point Gate 11B will call: builds the
 * confirmation content from trusted persisted order data (pure — see
 * `domain/email/order-confirmation-content.ts`) and hands it to
 * whichever provider `getProvider()` selects.
 *
 * NOT called anywhere in Gate 11A, deliberately
 * (docs/10-IMPLEMENTATION-PLAN.md Phase 11 Gate 11A §22). Gate 11B
 * wires this into the two proven idempotent transition points —
 * `createOrder()`'s `"created"` result (never `"existing"`) for
 * seller-payment orders, and `applySuccessfulOnlinePayment()`'s real
 * state-transition branch (never its early "already SUCCEEDED"
 * return) for online orders — never into every retry/replay of those
 * paths. See the Gate 11A report's "Idempotency/concurrency
 * requirements" finding for why the placement matters.
 */
export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
  /**
   * Gate 11B defense-in-depth only (docs/08-PAYMENTS.md-style framing:
   * not a substitute for the DB-level exactly-once guarantee — see
   * `dispatchOrderConfirmationEmail()` below). Forwarded to the
   * provider's `Idempotency-Key`/equivalent mechanism when supported;
   * the fake test provider records it without using it for anything.
   */
  idempotencyKey?: string,
): Promise<SendEmailSuccess> {
  const content = buildOrderConfirmationEmail(input);
  return getProvider().sendEmail({
    to: input.order.customerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey,
  });
}

/** Safe, non-sensitive failure category for `EMAIL_FAILED` OrderEvent metadata — never the raw provider message/body. */
function classifyEmailFailure(
  error: unknown,
): "configuration" | "provider-rejected" | "network" | "unknown" {
  if (error instanceof EmailConfigurationError) {
    return "configuration";
  }
  if (error instanceof EmailProviderRejectedError) {
    return "provider-rejected";
  }
  if (error instanceof EmailNetworkError) {
    return "network";
  }
  return "unknown";
}

type EventDbHandle = Pick<typeof db, "insert">;

/**
 * `AUTOMATIC` (Gate 11B, the default — every existing call site is
 * unchanged) or `ADMIN_RESEND` (Gate 11C). Recorded explicitly in
 * `EMAIL_SENT`/`EMAIL_FAILED` metadata going forward — deliberately not
 * inferring "absent means automatic" for NEW events (an admin reading
 * raw event data later should never have to guess); existing historical
 * rows written before this field existed are simply older data, treated
 * as legacy/automatic by the admin UI, never rewritten
 * (docs/09-SECURITY.md §63 "corrections create new events, never
 * rewrite old history").
 */
export interface DispatchOrderConfirmationEmailOptions {
  trigger: "AUTOMATIC" | "ADMIN_RESEND";
  actor: { type: "SYSTEM" } | { type: "ADMIN"; adminUserId: string };
}

const DEFAULT_DISPATCH_OPTIONS: DispatchOrderConfirmationEmailOptions = {
  trigger: "AUTOMATIC",
  actor: { type: "SYSTEM" },
};

/**
 * Gate 11B/11C — the one shared "send + record" step used by all three
 * dispatch paths (`createOrder()`'s SELLER-payment transition,
 * `applySuccessfulOnlinePayment()`'s ONLINE-payment transition, and
 * Gate 11C's admin manual resend). Must be called only after the
 * caller's own business transaction has genuinely, durably committed —
 * never from inside an open transaction (see the `dbHandle === db`
 * guards at the two automatic call sites; the admin action always owns
 * its own top-level `db` handle, so the same property holds trivially).
 *
 * Never throws: neither a failed send nor a failed OrderEvent write may
 * ever escape into a caller whose order/payment success has already
 * committed and must stand regardless (docs/05-ARCHITECTURE.md §30).
 *
 * Idempotency key (defense-in-depth only, never the primary correctness
 * mechanism — see each call site's own gating for that):
 * - `AUTOMATIC`: the stable, per-order `order-confirmation/<orderId>` —
 *   unchanged from Gate 11B.
 * - `ADMIN_RESEND`: a FRESH, server-generated, non-PII
 *   `order-confirmation/resend/<orderId>/<randomUUID>` on every call —
 *   deliberately never the automatic key (reusing it could make Resend
 *   treat an intentional resend as a retry of the original automatic
 *   send and silently return its cached result instead of actually
 *   sending again). This guarantees an intentional second resend always
 *   sends. It provides NO cross-request double-submission protection by
 *   itself (a genuinely separate/replayed Server Action invocation
 *   generates its own fresh id and would send again) — the accepted
 *   protection for accidental double-clicks is the client's
 *   `disabled={isPending}` submit button, not this key. See the Gate
 *   11C report for the full, honestly-documented limitation.
 */
export async function dispatchOrderConfirmationEmail(
  dbHandle: EventDbHandle,
  orderId: string,
  input: OrderConfirmationEmailInput,
  options: DispatchOrderConfirmationEmailOptions = DEFAULT_DISPATCH_OPTIONS,
): Promise<{ status: "EMAIL_SENT" | "EMAIL_FAILED" }> {
  const variant = input.paymentMethod === "SELLER" ? "SELLER_PAYMENT" : "ONLINE_PAID";
  const idempotencyKey =
    options.trigger === "ADMIN_RESEND"
      ? `order-confirmation/resend/${orderId}/${randomUUID()}`
      : `order-confirmation/${orderId}`;

  let type: "EMAIL_SENT" | "EMAIL_FAILED" = "EMAIL_SENT";
  let category: string | undefined;
  try {
    await sendOrderConfirmationEmail(input, idempotencyKey);
  } catch (error) {
    type = "EMAIL_FAILED";
    category = classifyEmailFailure(error);
  }

  try {
    await dbHandle.insert(orderEvents).values({
      orderId,
      type,
      actorType: options.actor.type,
      adminUserId: options.actor.type === "ADMIN" ? options.actor.adminUserId : null,
      metadata:
        type === "EMAIL_SENT"
          ? { emailType: "ORDER_CONFIRMATION", variant, trigger: options.trigger }
          : { emailType: "ORDER_CONFIRMATION", variant, trigger: options.trigger, category },
    });
  } catch {
    // Recording the audit event failed — never let this escape either.
    // The send attempt above already happened (or failed) on its own
    // terms, and the underlying order/payment result already committed
    // and must stand regardless of this write's outcome.
  }

  return { status: type };
}

export type ResendOrderConfirmationResult =
  | { status: "SENT" }
  | { status: "FAILED" }
  | { status: "INELIGIBLE"; reason: ConfirmationEligibilityReason };

/**
 * Gate 11C — the admin manual-resend orchestration: eligibility check →
 * build content from the SAME persisted order/items the caller already
 * fetched → dispatch with `trigger: "ADMIN_RESEND"`. The caller (the
 * admin Server Action) is responsible for fetching `order`/`items`/
 * `payments` fresh and for authenticating the admin — this function
 * trusts `adminUserId` as already-verified, exactly like every other
 * infrastructure mutation in this codebase trusts the actor id its
 * Server Action passed in (see `create-order.ts`'s `OrderCreationActor`
 * for the identical convention).
 */
export async function resendOrderConfirmation(
  dbHandle: Pick<typeof db, "select" | "insert">,
  orderId: string,
  order: PersistedOrderForConfirmation & { status: string; customerPaymentStatus: string },
  items: ReadonlyArray<PersistedOrderItemForConfirmation>,
  payments: readonly ConfirmationEligibilityPaymentInput[],
  adminUserId: string,
): Promise<ResendOrderConfirmationResult> {
  const eligibility = resolveOrderConfirmationEligibility(order, payments);
  if (!eligibility.eligible) {
    return { status: "INELIGIBLE", reason: eligibility.reason };
  }

  const input = await buildOrderConfirmationEmailInput(
    dbHandle,
    order,
    items,
    eligibility.paymentMethod,
  );
  const dispatchResult = await dispatchOrderConfirmationEmail(dbHandle, orderId, input, {
    trigger: "ADMIN_RESEND",
    actor: { type: "ADMIN", adminUserId },
  });

  return { status: dispatchResult.status === "EMAIL_SENT" ? "SENT" : "FAILED" };
}
