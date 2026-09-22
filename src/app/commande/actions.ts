"use server";

import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { sellers } from "@/infrastructure/database/schema";
import { createOrder } from "@/infrastructure/orders/create-order";
import { initiateOnlinePayment } from "@/infrastructure/payments/online-payments";
import { orderCreationInputSchema } from "@/domain/orders/order-input-schema";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { formatCHF, money } from "@/domain/money";

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
  | { status: "error"; message: string };

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
