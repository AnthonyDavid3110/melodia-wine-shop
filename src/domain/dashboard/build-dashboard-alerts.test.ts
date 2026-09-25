import { describe, expect, it } from "vitest";
import { money } from "../money";
import { buildDashboardAlerts } from "./build-dashboard-alerts";

describe("buildDashboardAlerts", () => {
  it("returns no alerts when every condition is zero", () => {
    const alerts = buildDashboardAlerts([], money(0));
    expect(alerts).toEqual([]);
  });

  it("shows the unassigned-orders alert, excluding CANCELLED, with correct pluralization", () => {
    const alerts = buildDashboardAlerts(
      [
        { status: "CONFIRMED", sellerId: null, customerPaymentStatus: "PENDING" },
        { status: "NEW", sellerId: null, customerPaymentStatus: "PENDING" },
        { status: "CANCELLED", sellerId: null, customerPaymentStatus: "PENDING" },
      ],
      money(0),
    );
    expect(alerts).toEqual([
      {
        id: "unassigned-orders",
        message: "2 commandes non attribuées",
        href: "/admin/commandes?seller=unassigned",
      },
    ]);
  });

  it("singularizes correctly for exactly one", () => {
    const alerts = buildDashboardAlerts(
      [{ status: "CONFIRMED", sellerId: null, customerPaymentStatus: "PENDING" }],
      money(0),
    );
    expect(alerts[0]!.message).toBe("1 commande non attribuée");
  });

  it("shows the outstanding-settlements alert with the formatted amount", () => {
    const alerts = buildDashboardAlerts([], money(62_000));
    expect(alerts).toEqual([
      {
        id: "outstanding-settlements",
        message: "CHF 620.– encaissés par les vendeurs restent à reverser à Mélodia",
        href: "/admin/vendeurs",
      },
    ]);
  });

  it("shows the delivered-unpaid alert only for DELIVERED + PENDING orders", () => {
    const alerts = buildDashboardAlerts(
      [
        { status: "DELIVERED", sellerId: "seller-1", customerPaymentStatus: "PENDING" },
        { status: "DELIVERED", sellerId: "seller-1", customerPaymentStatus: "PAID" },
        { status: "HANDED_TO_SELLER", sellerId: "seller-1", customerPaymentStatus: "PENDING" },
      ],
      money(0),
    );
    expect(alerts).toEqual([
      {
        id: "delivered-unpaid",
        message: "1 commande livrée encore indiquée comme non payée",
        href: "/admin/commandes?status=DELIVERED&paymentStatus=PENDING",
      },
    ]);
  });

  it("returns all three alerts in a fixed order when all conditions are met", () => {
    const alerts = buildDashboardAlerts(
      [
        { status: "CONFIRMED", sellerId: null, customerPaymentStatus: "PENDING" },
        { status: "DELIVERED", sellerId: "seller-1", customerPaymentStatus: "PENDING" },
      ],
      money(10_000),
    );
    expect(alerts.map((alert) => alert.id)).toEqual([
      "unassigned-orders",
      "outstanding-settlements",
      "delivered-unpaid",
    ]);
  });
});
