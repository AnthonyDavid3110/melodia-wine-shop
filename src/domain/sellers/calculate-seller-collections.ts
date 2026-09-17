import { type Money, sumMoney } from "../money";

export interface SellerPaymentOrderInput {
  totalAmount: Money;
  customerPaymentStatus: "PENDING" | "PAID" | "REFUNDED";
  /** True once this order's amount is included in a SETTLED SellerSettlement. */
  settled: boolean;
}

export interface SellerCollectionSummary {
  /** Seller-payment orders the customer has not yet paid the seller for. */
  stillToCollect: Money;
  /** Seller-payment orders the customer has paid the seller for (settled or not). */
  collected: Money;
  /** Collected but not yet included in a completed SellerSettlement. */
  stillToRemit: Money;
}

/**
 * The three seller-payment figures from docs/04-DATA-MODEL.md §30 and
 * the seller financial overview (docs/03-USER-FLOWS.md §33). Callers
 * pass only orders whose payment method is SELLER for this seller —
 * filtering by method/seller is the caller's (infrastructure-layer)
 * responsibility, since it depends on how orders are queried.
 * REFUNDED orders are intentionally excluded from all three figures.
 */
export function calculateSellerCollections(
  orders: readonly SellerPaymentOrderInput[],
): SellerCollectionSummary {
  const pending = orders.filter((order) => order.customerPaymentStatus === "PENDING");
  const paid = orders.filter((order) => order.customerPaymentStatus === "PAID");
  const paidNotYetSettled = paid.filter((order) => !order.settled);

  return {
    stillToCollect: sumMoney(pending.map((order) => order.totalAmount)),
    collected: sumMoney(paid.map((order) => order.totalAmount)),
    stillToRemit: sumMoney(paidNotYetSettled.map((order) => order.totalAmount)),
  };
}
