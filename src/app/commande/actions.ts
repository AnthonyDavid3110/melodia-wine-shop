"use server";

import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { sellers } from "@/infrastructure/database/schema";
import { createOrder, orderExistsForIdempotencyKey } from "@/infrastructure/orders/create-order";
import { initiateOnlinePayment } from "@/infrastructure/payments/online-payments";
import { orderCreationInputSchema } from "@/domain/orders/order-input-schema";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { formatCHF, money } from "@/domain/money";
import { getCurrentRateLimitIdentity } from "@/infrastructure/rate-limit/current-identity";
import { consumeRateLimit } from "@/infrastructure/rate-limit/rate-limit";
import { ORDER_CREATION, PAYMENT_INITIATION } from "@/infrastructure/rate-limit/policies";

const RATE_LIMIT_MESSAGE =
  "Trop de tentatives récentes. Veuillez réessayer dans quelques instants.";

export interface CheckoutLineSummary {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface CheckoutConfirmation {
  orderNumber: string;
  customerName: string;
  items: CheckoutLineSummary[];
  total: string;
  sellerName: string | null;
}

export type CheckoutActionResult =
  | { status: "success"; confirmation: CheckoutConfirmation }
  /** Phase 10 Gate 10B — an online (TWINT/CARD) order was created; the browser must navigate to `redirectUrl` (the real Saferpay Payment Page), never treat this as payment success. */
  | { status: "redirect"; redirectUrl: string }
  | { status: "validation-error"; fieldErrors: Partial<Record<string, string[]>> }
  | { status: "cart-error"; message: string }
  | { status: "error"; message: string }
  /** Phase 14 Gate 14B — source-based throttling, never a fatal-looking error (docs/09-SECURITY.md). */
  | { status: "rate-limited"; message: string };

/**
 * The ONE public entry point into the order-creation core (Phase 7).
 * Called directly by `checkout-form.tsx` (not bound to a native
 * `<form action>`) so it can accept the hydrated cart's structured
 * items — never a hidden-input JSON blob, never anything read from
 * `localStorage` server-side (the server has none). Every field here is
 * re-validated by `orderCreationInputSchema`; nothing the browser sends
 * is trusted beyond identities/quantities/text (docs/09-SECURITY.md
 * §6/§7, BR-CART-002).
 */
export async function submitCheckoutAction(payload: unknown): Promise<CheckoutActionResult> {
  const parsed = orderCreationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "validation-error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let result;
  try {
    // Phase 14 Gate 14B: a legitimate retry of an already-persisted
    // idempotency key never consumes new-order quota — only a
    // genuinely NEW key reaches the rate limiter (approved Step 1 §13).
    const alreadyExists = await orderExistsForIdempotencyKey(parsed.data.idempotencyKey);
    if (!alreadyExists) {
      const identity = await getCurrentRateLimitIdentity();
      const { allowed } = await consumeRateLimit(identity, ORDER_CREATION);
      if (!allowed) {
        return { status: "rate-limited", message: RATE_LIMIT_MESSAGE };
      }
    }
    result = await createOrder(parsed.data, { type: "SYSTEM" }, "ONLINE");
  } catch {
    // Never leak SQL/stack traces to the customer (docs/09-SECURITY.md §39).
    return {
      status: "error",
      message: "La commande n'a pas pu être enregistrée. Veuillez réessayer.",
    };
  }

  if (result.status === "rejected") {
    const { reason } = result;
    if (reason === "empty-cart") {
      return { status: "cart-error", message: "Votre panier est vide." };
    }
    if (reason === "no-active-campaign" || reason === "stale-campaign") {
      return {
        status: "cart-error",
        message:
          "La vente a changé depuis que vous avez composé votre panier. Veuillez le vérifier.",
      };
    }
    if (reason === "invalid-seller") {
      return {
        status: "cart-error",
        message:
          "Le membre sélectionné n'est plus disponible. Veuillez le sélectionner à nouveau ou continuer sans vendeur.",
      };
    }
    return {
      status: "cart-error",
      message:
        "Certains articles de votre panier ne sont plus disponibles. Veuillez retourner au panier.",
    };
  }

  if (parsed.data.paymentMethod === "TWINT" || parsed.data.paymentMethod === "CARD") {
    try {
      // Phase 14 Gate 14B: only consume bucket B when an Initialize
      // call is actually about to happen — never merely because an
      // online method was selected (approved Step 1 §14). Gated on
      // `"created"` only: an idempotent `"existing"` result never
      // reaches here as a NEW attempt in the first place, since the
      // browser already navigated away on the original attempt.
      if (result.status === "created") {
        const identity = await getCurrentRateLimitIdentity();
        const { allowed } = await consumeRateLimit(identity, PAYMENT_INITIATION);
        if (!allowed) {
          // The Order already exists and remains valid/retryable — never rolled back merely because initialization was throttled.
          return { status: "rate-limited", message: RATE_LIMIT_MESSAGE };
        }
      }
      const { redirectUrl } = await initiateOnlinePayment(
        result.order.id,
        parsed.data.paymentMethod,
      );
      return { status: "redirect", redirectUrl };
    } catch {
      // Never leak provider/SQL details to the customer (docs/09-SECURITY.md §39).
      // The Order itself remains valid and NEW — retry is possible.
      return {
        status: "error",
        message:
          "Le paiement en ligne n'a pas pu être initié. Veuillez réessayer ou choisir le paiement au membre.",
      };
    }
  }

  let sellerName: string | null = null;
  if (result.order.sellerId) {
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, result.order.sellerId));
    if (seller) {
      sellerName = formatSellerName(seller);
    }
  }

  return {
    status: "success",
    confirmation: {
      orderNumber: result.order.orderNumber,
      customerName: `${result.order.customerFirstName} ${result.order.customerLastName}`,
      items: result.items.map((item) => ({
        name: item.nameSnapshot,
        quantity: item.quantity,
        unitPrice: formatCHF(money(item.unitPriceAmount)),
        lineTotal: formatCHF(money(item.lineTotalAmount)),
      })),
      total: formatCHF(money(result.order.totalAmount)),
      sellerName,
    },
  };
}
