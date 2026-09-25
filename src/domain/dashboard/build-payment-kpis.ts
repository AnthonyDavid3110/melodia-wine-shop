import { type Money, sumMoney } from "../money";
import { calculateSellerCollections } from "../sellers/calculate-seller-collections";

export interface DashboardOrderInput {
  status: string;
  totalAmount: Money;
  customerPaymentStatus: "PENDING" | "PAID" | "REFUNDED";
  sellerSettlementStatus: string;
  sellerId: string | null;
  /** The authoritative method (`selectAuthoritativePaymentForExport()`'s result), or `null` when no payment row exists yet. */
  paymentMethod: string | null;
}

export interface PaymentKpis {
  /** Sales value of TWINT/CARD orders already PAID — money genuinely collected online. */
  onlinePaid: Money;
  /** Sales value attributed to the SELLER payment channel, paid or not (mirrors BR-COL-002's "seller-payment sales"). */
  sellerPayment: Money;
  /** Money still expected FROM customers on SELLER-payment orders. */
  outstandingCustomerPayments: Money;
  /** Money already collected BY sellers FROM customers, not yet remitted TO ECM. */
  outstandingSellerSettlements: Money;
}

/**
 * Dashboard "Payment KPIs" (docs/06-ADMIN-SPEC.md §5). Deliberately keeps
 * payment METHOD (TWINT/CARD/SELLER), customer payment STATUS
 * (PENDING/PAID/REFUNDED), and seller settlement STATUS
 * (PENDING/SETTLED) as three separate axes — never collapsed
 * (CLAUDE.md §11). `outstandingCustomerPayments` and
 * `outstandingSellerSettlements` both come from the same
 * `calculateSellerCollections()` call, so they structurally can never
 * be inferred from one another or drift apart.
 */
export function buildPaymentKpis(orders: readonly DashboardOrderInput[]): PaymentKpis {
  const eligible = orders.filter((order) => order.status !== "CANCELLED");

  const onlinePaidOrders = eligible.filter(
    (order) =>
      (order.paymentMethod === "TWINT" || order.paymentMethod === "CARD") &&
      order.customerPaymentStatus === "PAID",
  );
  const onlinePaid = sumMoney(onlinePaidOrders.map((order) => order.totalAmount));

  const sellerMethodOrders = eligible.filter((order) => order.paymentMethod === "SELLER");
  const sellerPayment = sumMoney(sellerMethodOrders.map((order) => order.totalAmount));

  const collections = calculateSellerCollections(
    sellerMethodOrders.map((order) => ({
      totalAmount: order.totalAmount,
      customerPaymentStatus: order.customerPaymentStatus,
      settled: order.sellerSettlementStatus === "SETTLED",
    })),
  );

  return {
    onlinePaid,
    sellerPayment,
    outstandingCustomerPayments: collections.stillToCollect,
    outstandingSellerSettlements: collections.stillToRemit,
  };
}
