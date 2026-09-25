export interface OperationalKpis {
  unassignedOrders: number;
  toPrepare: number;
  prepared: number;
  delivered: number;
}

/**
 * Dashboard "Operational KPIs" (docs/06-ADMIN-SPEC.md §5). Mirrors the
 * exact status semantics `canPrepareOrder`/`canHandOrderToSeller`/
 * `canMarkOrderDelivered` already use (`src/domain/orders/order-guards.ts`):
 * CONFIRMED = to prepare, PREPARED, DELIVERED. "Unassigned" excludes
 * CANCELLED — a cancelled order with no seller isn't operationally
 * actionable (BR-CAN-002's exclusion principle applied here).
 */
export function buildOperationalKpis(
  orders: readonly { status: string; sellerId: string | null }[],
): OperationalKpis {
  return {
    unassignedOrders: orders.filter(
      (order) => order.status !== "CANCELLED" && order.sellerId === null,
    ).length,
    toPrepare: orders.filter((order) => order.status === "CONFIRMED").length,
    prepared: orders.filter((order) => order.status === "PREPARED").length,
    delivered: orders.filter((order) => order.status === "DELIVERED").length,
  };
}
