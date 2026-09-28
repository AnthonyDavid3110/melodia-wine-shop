"use server";

import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { payments } from "@/infrastructure/database/schema";
import {
  confirmOnlinePayment,
  initiateOnlinePayment,
} from "@/infrastructure/payments/online-payments";
import { getCurrentRateLimitIdentity } from "@/infrastructure/rate-limit/current-identity";
import { consumeRateLimit } from "@/infrastructure/rate-limit/rate-limit";
import { PAYMENT_INITIATION, STATUS_POLLING } from "@/infrastructure/rate-limit/policies";

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
    // Phase 14 Gate 14B: preserve the cheap terminal-state short-circuit
    // — a payment that's already SUCCEEDED/FAILED/CANCELLED never
    // consumes bucket C, since `confirmOnlinePayment()` itself would
    // only do a local read for it anyway (approved Step 1 §15).
    const [payment] = await db.select().from(payments).where(eq(payments.returnToken, returnToken));
    const isAlreadyTerminal =
      payment !== undefined &&
      (payment.status === "SUCCEEDED" ||
        payment.status === "FAILED" ||
        payment.status === "CANCELLED");

    if (!isAlreadyTerminal) {
      const identity = await getCurrentRateLimitIdentity();
      const { allowed } = await consumeRateLimit(identity, STATUS_POLLING);
      if (!allowed) {
        // Automatic UI polling treats this as an ordinary transient
        // state, never a scary/fatal error (approved Step 1 §17).
        return { status: "PROCESSING" };
      }
    }

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
    // Phase 14 Gate 14B: the SAME bucket as the checkout-path Initialize
    // call — both are the identical threat (approved Step 1 §14).
    const identity = await getCurrentRateLimitIdentity();
    const { allowed } = await consumeRateLimit(identity, PAYMENT_INITIATION);
    if (!allowed) {
      return {
        status: "error",
        message: "Trop de tentatives récentes. Veuillez réessayer dans quelques instants.",
      };
    }
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
