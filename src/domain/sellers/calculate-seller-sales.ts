import { type Money, money, subtractMoney, sumMoney } from "../money";

export interface SellerSalesOrderInput {
  status: string;
  totalAmount: Money;
  /** Sum of any refunds against this order, if applicable. */
  refundedAmount?: Money;
}

/**
 * Seller sales = sum of eligible attributed order totals, minus
 * refunded amounts (docs/04-DATA-MODEL.md §29, BR-SEL-006/007/008,
 * TBD-BR-005 recommended rule). CANCELLED orders are excluded
 * entirely — refunds are only meaningful on non-cancelled orders.
 */
export function calculateSellerSales(orders: readonly SellerSalesOrderInput[]): Money {
  const eligible = orders.filter((order) => order.status !== "CANCELLED");
  const netAmounts = eligible.map((order) =>
    subtractMoney(order.totalAmount, order.refundedAmount ?? money(0)),
  );
  return sumMoney(netAmounts);
}
