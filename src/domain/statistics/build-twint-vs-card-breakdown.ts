import { type Money, sumMoney } from "../money";
import type { DashboardOrderInput } from "../dashboard/build-payment-kpis";

export interface TwintVsCardBreakdown {
  twint: Money;
  card: Money;
}

/**
 * "TWINT vs card" (docs/06-ADMIN-SPEC.md §50) — reuses the exact same
 * `DashboardOrderInput[]` array and eligible-population rule
 * `buildPaymentKpis()`'s `onlinePaid` figure already uses (non-
 * CANCELLED, authoritative payment method, `customerPaymentStatus =
 * PAID`), split further by method. SELLER-method orders never match
 * either bucket. The authoritative method itself is resolved once, by
 * the caller, via `selectAuthoritativePaymentForExport()` — never
 * re-derived here, so a retried/failed attempt can never be counted.
 */
export function buildTwintVsCardBreakdown(
  orders: readonly DashboardOrderInput[],
): TwintVsCardBreakdown {
  const eligible = orders.filter(
    (order) => order.status !== "CANCELLED" && order.customerPaymentStatus === "PAID",
  );
  const twint = eligible.filter((order) => order.paymentMethod === "TWINT");
  const card = eligible.filter((order) => order.paymentMethod === "CARD");

  return {
    twint: sumMoney(twint.map((order) => order.totalAmount)),
    card: sumMoney(card.map((order) => order.totalAmount)),
  };
}
