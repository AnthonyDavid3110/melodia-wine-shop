import { describe, expect, it } from "vitest";
import {
  buildPreparationSheetContent,
  type PreparationSheetItemInput,
  type PreparationSheetOrderInput,
} from "./build-preparation-sheet-content";

function baseOrder(
  overrides: Partial<PreparationSheetOrderInput> = {},
): PreparationSheetOrderInput {
  return {
    orderNumber: "ECM-2026-0042",
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    customerPhone: "079 000 00 00",
    deliveryNote: null,
    totalAmount: 19600,
    customerPaymentStatus: "PAID",
    preparedAt: null,
    handedToSellerAt: null,
    ...overrides,
  };
}

const productItem: PreparationSheetItemInput = {
  itemType: "PRODUCT",
  nameSnapshot: "Chasselas",
  quantity: 2,
  bundleComponents: [],
};

const bundleItem: PreparationSheetItemInput = {
  itemType: "BUNDLE",
  nameSnapshot: "Coffret Découverte",
  quantity: 1,
  bundleComponents: [
    { productNameSnapshot: "Chasselas", quantityPerBundle: 2 },
    { productNameSnapshot: "Pinot Noir", quantityPerBundle: 1 },
  ],
};

describe("buildPreparationSheetContent", () => {
  it("maps every documented field from a snapshot order", () => {
    const content = buildPreparationSheetContent(
      baseOrder(),
      [productItem],
      { firstName: "Anne", lastName: "Bornand" },
      "SELLER",
    );
    expect(content.orderNumber).toBe("ECM-2026-0042");
    expect(content.customerName).toBe("Jean Dupont");
    expect(content.address).toBe("Rue du Lac 15");
    expect(content.postalCode).toBe("1400");
    expect(content.city).toBe("Yverdon-les-Bains");
    expect(content.phone).toBe("079 000 00 00");
    expect(content.sellerName).toBe("Anne Bornand");
    expect(content.totalAmountFormatted).toBe("CHF 196.–");
    expect(content.paymentMethodLabel).toBe("Membre");
    expect(content.customerPaymentStatusLabel).toBe("Payée");
  });

  it("renders sellerName as null for an unassigned order (caller shows 'Non attribuée')", () => {
    const content = buildPreparationSheetContent(baseOrder(), [productItem], null, "SELLER");
    expect(content.sellerName).toBeNull();
  });

  it("carries the delivery note when present, and null when absent", () => {
    const withNote = buildPreparationSheetContent(
      baseOrder({ deliveryNote: "Appeler avant la livraison" }),
      [productItem],
      null,
      null,
    );
    expect(withNote.deliveryNote).toBe("Appeler avant la livraison");

    const withoutNote = buildPreparationSheetContent(baseOrder(), [productItem], null, null);
    expect(withoutNote.deliveryNote).toBeNull();
  });

  it("computes total bottles for a PRODUCT item directly", () => {
    const content = buildPreparationSheetContent(baseOrder(), [productItem], null, null);
    expect(content.totalBottles).toBe(2);
  });

  it("computes total bottles for a BUNDLE item as quantity × sum(quantityPerBundle)", () => {
    const content = buildPreparationSheetContent(baseOrder(), [bundleItem], null, null);
    // 1 bundle × (2 Chasselas + 1 Pinot Noir) = 3 bottles.
    expect(content.totalBottles).toBe(3);
  });

  it("sums PRODUCT and BUNDLE contributions together", () => {
    const content = buildPreparationSheetContent(
      baseOrder(),
      [productItem, bundleItem],
      null,
      null,
    );
    expect(content.totalBottles).toBe(2 + 3);
  });

  it("preserves bundle composition without fabricating a component price", () => {
    const content = buildPreparationSheetContent(baseOrder(), [bundleItem], null, null);
    expect(content.items).toHaveLength(1);
    expect(content.items[0]!.type).toBe("BUNDLE");
    expect(content.items[0]!.composition).toEqual([
      { name: "Chasselas", quantityPerBundle: 2 },
      { name: "Pinot Noir", quantityPerBundle: 1 },
    ]);
  });

  it("leaves composition empty for a PRODUCT row", () => {
    const content = buildPreparationSheetContent(baseOrder(), [productItem], null, null);
    expect(content.items[0]!.composition).toEqual([]);
  });

  it("reports an empty payment method label when no payment exists yet", () => {
    const content = buildPreparationSheetContent(baseOrder(), [productItem], null, null);
    expect(content.paymentMethodLabel).toBe("");
  });

  it("derives isPrepared/isHandedToSeller from the respective timestamps", () => {
    const neither = buildPreparationSheetContent(baseOrder(), [productItem], null, null);
    expect(neither.isPrepared).toBe(false);
    expect(neither.isHandedToSeller).toBe(false);

    const prepared = buildPreparationSheetContent(
      baseOrder({ preparedAt: new Date("2026-09-20T10:00:00Z") }),
      [productItem],
      null,
      null,
    );
    expect(prepared.isPrepared).toBe(true);
    expect(prepared.isHandedToSeller).toBe(false);

    const handed = buildPreparationSheetContent(
      baseOrder({
        preparedAt: new Date("2026-09-20T10:00:00Z"),
        handedToSellerAt: new Date("2026-09-21T10:00:00Z"),
      }),
      [productItem],
      null,
      null,
    );
    expect(handed.isHandedToSeller).toBe(true);
  });

  it("never includes fields explicitly excluded from the document (structural check)", () => {
    const content = buildPreparationSheetContent(baseOrder(), [productItem], null, "SELLER");
    const keys = Object.keys(content);
    expect(keys).not.toContain("customerEmail");
    expect(keys).not.toContain("sellerSettlementStatus");
    expect(keys).not.toContain("source");
    expect(keys).not.toContain("providerPaymentId");
  });
});
