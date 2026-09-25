import { describe, expect, it } from "vitest";
import {
  buildOrderConfirmationContent,
  buildReceiptContent,
  canGenerateOrderConfirmation,
  canGenerateReceipt,
  type OrderDocumentItemInput,
  type OrderDocumentOrderInput,
} from "./build-order-document-content";

function baseOrder(overrides: Partial<OrderDocumentOrderInput> = {}): OrderDocumentOrderInput {
  return {
    orderNumber: "ECM-2026-0042",
    createdAt: new Date("2026-09-15T10:00:00Z"),
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    totalAmount: 19600,
    customerPaymentStatus: "PAID",
    ...overrides,
  };
}

const productItem: OrderDocumentItemInput = {
  itemType: "PRODUCT",
  nameSnapshot: "Chasselas",
  unitPriceAmount: 1800,
  quantity: 2,
  lineTotalAmount: 3600,
  bundleComponents: [],
};

const bundleItem: OrderDocumentItemInput = {
  itemType: "BUNDLE",
  nameSnapshot: "Coffret Découverte",
  unitPriceAmount: 4500,
  quantity: 1,
  lineTotalAmount: 4500,
  bundleComponents: [
    { productNameSnapshot: "Chasselas", quantityPerBundle: 2 },
    { productNameSnapshot: "Pinot Noir", quantityPerBundle: 1 },
  ],
};

describe("canGenerateOrderConfirmation", () => {
  it("is eligible for every non-CANCELLED status", () => {
    for (const status of ["NEW", "CONFIRMED", "PREPARED", "HANDED_TO_SELLER", "DELIVERED"]) {
      expect(canGenerateOrderConfirmation({ status })).toBe(true);
    }
  });

  it("is not eligible for CANCELLED", () => {
    expect(canGenerateOrderConfirmation({ status: "CANCELLED" })).toBe(false);
  });
});

describe("canGenerateReceipt", () => {
  it("is eligible only when PAID and not CANCELLED", () => {
    expect(canGenerateReceipt({ status: "CONFIRMED", customerPaymentStatus: "PAID" })).toBe(true);
  });

  it("is not eligible when PENDING", () => {
    expect(canGenerateReceipt({ status: "NEW", customerPaymentStatus: "PENDING" })).toBe(false);
  });

  it("is not eligible when REFUNDED", () => {
    expect(canGenerateReceipt({ status: "CONFIRMED", customerPaymentStatus: "REFUNDED" })).toBe(
      false,
    );
  });

  it("is not eligible when CANCELLED even if somehow PAID", () => {
    expect(canGenerateReceipt({ status: "CANCELLED", customerPaymentStatus: "PAID" })).toBe(false);
  });
});

describe("buildOrderConfirmationContent", () => {
  it("uses the exact approved title and organisation identity", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    expect(content.variant).toBe("ORDER_CONFIRMATION");
    expect(content.title).toBe("Confirmation de commande");
    expect(content.organisationName).toBe("Ensemble de Cuivres Mélodia");
    expect(content.organisationAddressLines).toEqual([
      "c/o Amanda Maurer, présidente",
      "Route de Lavigny 3",
      "1163 Etoy",
      "Suisse",
    ]);
  });

  it("labels the order reference as 'Référence de commande' content, never an invoice number", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    expect(content.orderReference).toBe("ECM-2026-0042");
  });

  it("never sets a paymentStatusLine", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    expect(content.paymentStatusLine).toBeNull();
  });

  it("formats customer name, address, and order date", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    expect(content.customerName).toBe("Jean Dupont");
    expect(content.customerAddress).toBe("Rue du Lac 15");
    expect(content.customerPostalCode).toBe("1400");
    expect(content.customerCity).toBe("Yverdon-les-Bains");
    expect(content.orderDate).toBe(new Date("2026-09-15T10:00:00Z").toLocaleDateString("fr-CH"));
  });

  it("includes quantity, unit price, and line total per item", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    expect(content.items).toHaveLength(1);
    expect(content.items[0]!.name).toBe("Chasselas");
    expect(content.items[0]!.quantity).toBe(2);
    expect(content.items[0]!.unitPriceFormatted).toBe("CHF 18.–");
    expect(content.items[0]!.lineTotalFormatted).toBe("CHF 36.–");
  });

  it("keeps the bundle line as the single priced commercial row, components informational only", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [bundleItem], "TWINT");
    expect(content.items).toHaveLength(1);
    expect(content.items[0]!.lineTotalFormatted).toBe("CHF 45.–");
    expect(content.items[0]!.composition).toEqual([
      { name: "Chasselas", quantityPerBundle: 2 },
      { name: "Pinot Noir", quantityPerBundle: 1 },
    ]);
  });

  it("maps TWINT/CARD/SELLER to the approved customer-facing phrases", () => {
    expect(
      buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT").paymentMethodLabel,
    ).toBe("TWINT");
    expect(
      buildOrderConfirmationContent(baseOrder(), [productItem], "CARD").paymentMethodLabel,
    ).toBe("Carte");
    expect(
      buildOrderConfirmationContent(baseOrder(), [productItem], "SELLER").paymentMethodLabel,
    ).toBe("Paiement au membre ECM");
  });

  it("reports an empty payment method label when no payment exists yet", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], null);
    expect(content.paymentMethodLabel).toBe("");
  });

  it("never includes seller, customer note, email, phone, or internal identifiers as fields", () => {
    const content = buildOrderConfirmationContent(baseOrder(), [productItem], "TWINT");
    const keys = Object.keys(content);
    expect(keys).not.toContain("sellerName");
    expect(keys).not.toContain("deliveryNote");
    expect(keys).not.toContain("customerEmail");
    expect(keys).not.toContain("customerPhone");
    expect(keys).not.toContain("providerPaymentId");
  });
});

describe("buildReceiptContent", () => {
  it("uses the exact approved title and payment status line", () => {
    const content = buildReceiptContent(
      baseOrder({ customerPaymentStatus: "PAID" }) as ReturnType<typeof baseOrder> & {
        customerPaymentStatus: "PAID";
      },
      [productItem],
      "TWINT",
    );
    expect(content.variant).toBe("RECEIPT");
    expect(content.title).toBe("Reçu");
    expect(content.paymentStatusLine).toBe("Paiement : Payé");
  });

  it("shares the exact same commercial content model as the confirmation (organisation, items, totals)", () => {
    const paidOrder = baseOrder({ customerPaymentStatus: "PAID" }) as ReturnType<
      typeof baseOrder
    > & {
      customerPaymentStatus: "PAID";
    };
    const confirmation = buildOrderConfirmationContent(
      paidOrder,
      [productItem, bundleItem],
      "SELLER",
    );
    const receipt = buildReceiptContent(paidOrder, [productItem, bundleItem], "SELLER");
    expect(receipt.organisationName).toBe(confirmation.organisationName);
    expect(receipt.items).toEqual(confirmation.items);
    expect(receipt.totalAmountFormatted).toBe(confirmation.totalAmountFormatted);
    expect(receipt.orderReference).toBe(confirmation.orderReference);
  });
});
