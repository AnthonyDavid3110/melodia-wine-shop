import { describe, expect, it } from "vitest";
import { buildPreparationSheetContent } from "./build-preparation-sheet-content";
import { buildSellerPreparationSummaryContent } from "./build-seller-preparation-summary-content";

function order(orderNumber: string, totalBottles: number) {
  return buildPreparationSheetContent(
    {
      orderNumber,
      customerFirstName: "Jean",
      customerLastName: "Dupont",
      customerAddress: "Rue du Lac 15",
      customerPostalCode: "1400",
      customerCity: "Yverdon-les-Bains",
      customerPhone: "079 000 00 00",
      deliveryNote: null,
      totalAmount: 1800,
      customerPaymentStatus: "PAID",
      preparedAt: null,
      handedToSellerAt: null,
    },
    [
      {
        itemType: "PRODUCT",
        nameSnapshot: "Chasselas",
        quantity: totalBottles,
        bundleComponents: [],
      },
    ],
    { firstName: "Anne", lastName: "Bornand" },
    "SELLER",
  );
}

describe("buildSellerPreparationSummaryContent", () => {
  it("reuses the caller's already-computed sales total, never recalculating it", () => {
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      234000,
      [order("ECM-2026-0001", 3)],
    );
    expect(summary.totalSalesFormatted).toBe("CHF 2'340.–");
    expect(summary.sellerName).toBe("Anne Bornand");
    expect(summary.campaignName).toBe("Les Vins de Mélodia 2026");
  });

  it("derives orderCount and totalBottles from the shared per-order content, not independently", () => {
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      0,
      [order("ECM-2026-0001", 3), order("ECM-2026-0002", 4)],
    );
    expect(summary.orderCount).toBe(2);
    expect(summary.totalBottles).toBe(7);
  });

  it("embeds the exact same PreparationSheetContent objects — no second representation of an order", () => {
    const orderContent = order("ECM-2026-0001", 3);
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      0,
      [orderContent],
    );
    expect(summary.orders[0]).toBe(orderContent);
  });

  it("handles zero orders", () => {
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      0,
      [],
    );
    expect(summary.orderCount).toBe(0);
    expect(summary.totalBottles).toBe(0);
    expect(summary.orders).toEqual([]);
  });
});
