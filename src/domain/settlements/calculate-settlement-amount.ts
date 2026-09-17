import { type Money, sumMoney } from "../money";

export interface SettlementOrderInput {
  amount: Money;
}

/**
 * docs/08-PAYMENTS.md §36: the settlement total is always calculated
 * from the selected orders, never typed directly by an administrator —
 * this is the function that guarantees that.
 */
export function calculateSettlementAmount(selectedOrders: readonly SettlementOrderInput[]): Money {
  return sumMoney(selectedOrders.map((order) => order.amount));
}
