import { formatCHF, type Money } from "../money";

export interface DashboardAlert {
  id: "unassigned-orders" | "outstanding-settlements" | "delivered-unpaid";
  message: string;
  href: string;
}

/**
 * Dashboard "Actionable alerts" (docs/06-ADMIN-SPEC.md §6) — the three
 * REQUIRED alerts, each shown only when its condition is non-zero (no
 * congratulatory/vanity alerts). `outstandingSellerSettlements` is
 * passed in already computed by `buildPaymentKpis()` (via
 * `calculateSellerCollections()`) rather than re-derived here, so the
 * two can never disagree.
 *
 * `outstanding-settlements` links to `/admin/vendeurs` — the closest
 * real operational destination. No filtered "sellers who still owe
 * money this campaign" view exists yet (Gate 13A/13B finding); building
 * one is out of this gate's scope.
 */
export function buildDashboardAlerts(
  orders: readonly { status: string; sellerId: string | null; customerPaymentStatus: string }[],
  outstandingSellerSettlements: Money,
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const unassignedCount = orders.filter(
    (order) => order.status !== "CANCELLED" && order.sellerId === null,
  ).length;
  if (unassignedCount > 0) {
    alerts.push({
      id: "unassigned-orders",
      message: `${unassignedCount} commande${unassignedCount > 1 ? "s" : ""} non attribuée${unassignedCount > 1 ? "s" : ""}`,
      href: "/admin/commandes?seller=unassigned",
    });
  }

  if (outstandingSellerSettlements > 0) {
    alerts.push({
      id: "outstanding-settlements",
      message: `${formatCHF(outstandingSellerSettlements)} encaissés par les vendeurs restent à reverser à Mélodia`,
      href: "/admin/vendeurs",
    });
  }

  const deliveredUnpaidCount = orders.filter(
    (order) => order.status === "DELIVERED" && order.customerPaymentStatus === "PENDING",
  ).length;
  if (deliveredUnpaidCount > 0) {
    alerts.push({
      id: "delivered-unpaid",
      message: `${deliveredUnpaidCount} commande${deliveredUnpaidCount > 1 ? "s" : ""} livrée${deliveredUnpaidCount > 1 ? "s" : ""} encore indiquée${deliveredUnpaidCount > 1 ? "s" : ""} comme non payée${deliveredUnpaidCount > 1 ? "s" : ""}`,
      href: "/admin/commandes?status=DELIVERED&paymentStatus=PENDING",
    });
  }

  return alerts;
}
