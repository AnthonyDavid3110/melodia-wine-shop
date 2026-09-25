import { describe, expect, it } from "vitest";
import { buildPreparationSheetContent } from "@/domain/documents/build-preparation-sheet-content";
import { buildSellerPreparationSummaryContent } from "@/domain/documents/build-seller-preparation-summary-content";
import {
  buildOrderConfirmationContent,
  buildReceiptContent,
  type OrderDocumentItemInput,
  type OrderDocumentOrderInput,
} from "@/domain/documents/build-order-document-content";
import {
  renderOrderDocumentPdf,
  renderPreparationSheetPdf,
  renderSellerPreparationSummaryPdf,
} from "./pdf-renderer";

/**
 * Real-renderer smoke tests (Phase 12 Gate 12B, approved Step 2 §17)
 * — exercises the actual `@react-pdf/renderer` pipeline, not a mock.
 * Deliberately does NOT assert on exact rendered bytes/pixels: only
 * that generation succeeds and produces a structurally valid,
 * non-trivial PDF. Text-content safety (customer strings can never be
 * interpreted as markup) is a structural guarantee of `@react-pdf/
 * renderer`'s `<Text>` primitive, which never parses its children as
 * HTML — proven here by confirming a markup-like customer string
 * renders without throwing, not by extracting/parsing the resulting
 * PDF's text stream.
 */

function order(overrides: Partial<Parameters<typeof buildPreparationSheetContent>[0]> = {}) {
  return buildPreparationSheetContent(
    {
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
    },
    [{ itemType: "PRODUCT", nameSnapshot: "Chasselas", quantity: 2, bundleComponents: [] }],
    { firstName: "Anne", lastName: "Bornand" },
    "SELLER",
  );
}

function assertLooksLikeAPdf(buffer: Buffer) {
  expect(buffer.subarray(0, 4).toString("utf-8")).toBe("%PDF");
  expect(buffer.length).toBeGreaterThan(500);
}

describe("renderPreparationSheetPdf", () => {
  it("renders a normal order to a valid PDF buffer", async () => {
    const buffer = await renderPreparationSheetPdf(order(), "Les Vins de Mélodia 2026");
    assertLooksLikeAPdf(buffer);
  });

  it("renders an order with many line items without throwing", async () => {
    const manyItems = Array.from({ length: 25 }, (_, index) => ({
      itemType: "PRODUCT" as const,
      nameSnapshot: `Vin ${index + 1}`,
      quantity: index + 1,
      bundleComponents: [],
    }));
    const content = buildPreparationSheetContent(
      {
        orderNumber: "ECM-2026-0099",
        customerFirstName: "Jean",
        customerLastName: "Dupont",
        customerAddress: "Rue du Lac 15",
        customerPostalCode: "1400",
        customerCity: "Yverdon-les-Bains",
        customerPhone: "079 000 00 00",
        deliveryNote: null,
        totalAmount: 500000,
        customerPaymentStatus: "PAID",
        preparedAt: null,
        handedToSellerAt: null,
      },
      manyItems,
      { firstName: "Anne", lastName: "Bornand" },
      "SELLER",
    );
    const buffer = await renderPreparationSheetPdf(content, "Les Vins de Mélodia 2026");
    assertLooksLikeAPdf(buffer);
  });

  it("renders bundle composition without throwing", async () => {
    const withBundle = buildPreparationSheetContent(
      {
        orderNumber: "ECM-2026-0043",
        customerFirstName: "Jean",
        customerLastName: "Dupont",
        customerAddress: "Rue du Lac 15",
        customerPostalCode: "1400",
        customerCity: "Yverdon-les-Bains",
        customerPhone: "079 000 00 00",
        deliveryNote: "Sonner à l'interphone",
        totalAmount: 4500,
        customerPaymentStatus: "PENDING",
        preparedAt: new Date("2026-09-20T10:00:00Z"),
        handedToSellerAt: null,
      },
      [
        {
          itemType: "BUNDLE",
          nameSnapshot: "Coffret Découverte",
          quantity: 1,
          bundleComponents: [
            { productNameSnapshot: "Chasselas", quantityPerBundle: 2 },
            { productNameSnapshot: "Pinot Noir", quantityPerBundle: 1 },
          ],
        },
      ],
      null,
      null,
    );
    const buffer = await renderPreparationSheetPdf(withBundle, "Les Vins de Mélodia 2026");
    assertLooksLikeAPdf(buffer);
  });

  it("renders customer-controlled markup-like text as inert content without throwing", async () => {
    const content = buildPreparationSheetContent(
      {
        orderNumber: "ECM-2026-0044",
        customerFirstName: '<script>alert("x")</script>',
        customerLastName: "Dupont",
        customerAddress: "Rue du Lac 15",
        customerPostalCode: "1400",
        customerCity: "Yverdon-les-Bains",
        customerPhone: "079 000 00 00",
        deliveryNote: "<img src=x onerror=alert(1)>",
        totalAmount: 1800,
        customerPaymentStatus: "PAID",
        preparedAt: null,
        handedToSellerAt: null,
      },
      [{ itemType: "PRODUCT", nameSnapshot: "Chasselas", quantity: 1, bundleComponents: [] }],
      null,
      null,
    );
    const buffer = await renderPreparationSheetPdf(content, "Les Vins de Mélodia 2026");
    assertLooksLikeAPdf(buffer);
  });

  it("renders an accented French customer name correctly (no crash)", async () => {
    const content = order({ customerFirstName: "Amélie", customerLastName: "Müller-Genève" });
    const buffer = await renderPreparationSheetPdf(content, "Les Vins de Mélodia 2026");
    assertLooksLikeAPdf(buffer);
  });
});

describe("renderSellerPreparationSummaryPdf", () => {
  it("renders a seller with multiple orders (pagination exercised)", async () => {
    const orders = Array.from({ length: 12 }, (_, index) =>
      order({ orderNumber: `ECM-2026-${String(index + 1).padStart(4, "0")}` }),
    );
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      234000,
      orders,
    );
    const buffer = await renderSellerPreparationSummaryPdf(summary);
    assertLooksLikeAPdf(buffer);
  });

  it("renders a seller with zero orders without throwing (defensive)", async () => {
    const summary = buildSellerPreparationSummaryContent(
      { firstName: "Anne", lastName: "Bornand" },
      "Les Vins de Mélodia 2026",
      0,
      [],
    );
    const buffer = await renderSellerPreparationSummaryPdf(summary);
    assertLooksLikeAPdf(buffer);
  });
});

describe("renderOrderDocumentPdf", () => {
  function orderDocOrder(
    overrides: Partial<OrderDocumentOrderInput> = {},
  ): OrderDocumentOrderInput {
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

  it("renders an ORDER_CONFIRMATION to a valid PDF buffer", async () => {
    const content = buildOrderConfirmationContent(orderDocOrder(), [productItem], "TWINT");
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });

  it("renders a RECEIPT to a valid PDF buffer", async () => {
    const paid = orderDocOrder({ customerPaymentStatus: "PAID" }) as OrderDocumentOrderInput & {
      customerPaymentStatus: "PAID";
    };
    const content = buildReceiptContent(paid, [productItem], "SELLER");
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });

  it("renders bundle composition without throwing", async () => {
    const content = buildOrderConfirmationContent(orderDocOrder(), [bundleItem], "CARD");
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });

  it("renders customer-controlled markup-like text as inert content without throwing", async () => {
    const content = buildOrderConfirmationContent(
      orderDocOrder({
        customerFirstName: '<script>alert("x")</script>',
        customerAddress: "<img src=x onerror=alert(1)>",
      }),
      [productItem],
      "TWINT",
    );
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });

  it("renders the accented organisation address and an accented customer name correctly", async () => {
    const content = buildOrderConfirmationContent(
      orderDocOrder({ customerFirstName: "Amélie", customerLastName: "Müller-Genève" }),
      [productItem],
      "TWINT",
    );
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });

  it("renders many line items without throwing", async () => {
    const manyItems: OrderDocumentItemInput[] = Array.from({ length: 20 }, (_, index) => ({
      itemType: "PRODUCT",
      nameSnapshot: `Vin ${index + 1}`,
      unitPriceAmount: 1800,
      quantity: index + 1,
      lineTotalAmount: 1800 * (index + 1),
      bundleComponents: [],
    }));
    const content = buildOrderConfirmationContent(orderDocOrder(), manyItems, "TWINT");
    const buffer = await renderOrderDocumentPdf(content);
    assertLooksLikeAPdf(buffer);
  });
});
