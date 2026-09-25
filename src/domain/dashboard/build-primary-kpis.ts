import { type Money, money, sumMoney } from "../money";

export interface PrimaryKpis {
  revenue: Money;
  orderCount: number;
  bottleCount: number;
  /** `null` when there are no eligible orders — never a division by zero. */
  averageOrderValue: Money | null;
}

/**
 * Dashboard "Primary KPIs" (docs/06-ADMIN-SPEC.md §5). Revenue and order
 * count exclude CANCELLED orders (BR-CAN-002: "active revenue" excludes
 * cancelled orders) — the same population `calculateSellerSales()`
 * already uses. `bottleCount` is passed in pre-aggregated: it comes from
 * `getCampaignWineRequirements()`, which applies the identical CANCELLED
 * exclusion via `calculateWineRequirements()`, so it is never
 * re-derived here.
 */
export function buildPrimaryKpis(
  orders: readonly { status: string; totalAmount: Money }[],
  bottleCount: number,
): PrimaryKpis {
  const eligible = orders.filter((order) => order.status !== "CANCELLED");
  const revenue = sumMoney(eligible.map((order) => order.totalAmount));
  const orderCount = eligible.length;
  const averageOrderValue = orderCount === 0 ? null : money(Math.round(revenue / orderCount));

  return { revenue, orderCount, bottleCount, averageOrderValue };
}
