"use server";

import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { payments } from "@/infrastructure/database/schema";
import {
  confirmOnlinePayment,
  initiateOnlinePayment,
} from "@/infrastructure/payments/online-payments";

export interface PaymentStatusView {
  status: "SUCCEEDED" | "PROCESSING" | "FAILED" | "CANCELLED" | "NOT_FOUND";
  orderNumber?: string;
}

/**
 * Polled by the client return view while a payment is still
 * PROCESSING (Gate 10B §12). Always re-derives the trusted state via
 * `confirmOnlinePayment()` — never trusts anything the browser claims
 * about its own payment outcome.
 */
export async function checkOnlinePaymentStatusAction(
  returnToken: string,
): Promise<PaymentStatusView> {
  try {
    const result = await confirmOnlinePayment(returnToken);
    return { status: result.status, orderNumber: result.orderNumber };
  } catch {
    return { status: "NOT_FOUND" };
  }
}

export type RetryPaymentResult =
  { status: "redirect"; redirectUrl: string } | { status: "error"; message: string };

/**
 * Retries payment for the SAME Order after a FAILED/CANCELLED attempt
 * (Gate 10B §18/§20) — never reconstructs the cart or creates a second
 * Order. Looked up by the opaque return token, not a client-supplied
 * order id.
 */
export async function retryOnlinePaymentAction(
  returnToken: string,
  method: "TWINT" | "CARD",
): Promise<RetryPaymentResult> {
  const [payment] = await db.select().from(payments).where(eq(payments.returnToken, returnToken));
  if (!payment) {
    return { status: "error", message: "Tentative de paiement introuvable." };
  }

  try {
    const { redirectUrl } = await initiateOnlinePayment(payment.orderId, method);
    return { status: "redirect", redirectUrl };
  } catch {
    return {
      status: "error",
      message:
        "Le paiement n'a pas pu être initié. Veuillez réessayer ou choisir le paiement au membre.",
    };
  }
}
