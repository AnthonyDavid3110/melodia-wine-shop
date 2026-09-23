import { describe, expect, it } from "vitest";
import {
  buildOrderConfirmationEmail,
  type OrderConfirmationEmailInput,
} from "./order-confirmation-content";

function baseInput(
  overrides: Partial<OrderConfirmationEmailInput> = {},
): OrderConfirmationEmailInput {
  return {
    order: {
      orderNumber: "ECM-2026-0042",
      customerFirstName: "Jean",
      customerLastName: "Dupont",
      customerEmail: "jean@example.ch",
      customerAddress: "Rue du Lac 15",
      customerPostalCode: "1400",
      customerCity: "Yverdon-les-Bains",
      deliveryNote: null,
      totalAmount: 19600,
    },
    items: [
      { nameSnapshot: "Chasselas", quantity: 2, lineTotalAmount: 3600 },
      { nameSnapshot: "Pinot Noir", quantity: 3, lineTotalAmount: 6000 },
      { nameSnapshot: "Carton découverte", quantity: 1, lineTotalAmount: 10000 },
    ],
    paymentMethod: "SELLER",
    sellerName: "Anthony David",
    ...overrides,
  };
}

describe("buildOrderConfirmationEmail — subject", () => {
  it("includes the human order number and the campaign name, never an internal ID", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    expect(content.subject).toBe("Commande ECM-2026-0042 confirmée — Les Vins de Mélodia");
  });

  it("uses the identical subject for both payment variants", () => {
    const online = buildOrderConfirmationEmail(baseInput({ paymentMethod: "TWINT" }));
    const seller = buildOrderConfirmationEmail(baseInput({ paymentMethod: "SELLER" }));
    expect(online.subject).toBe(seller.subject);
  });
});

describe("buildOrderConfirmationEmail — ONLINE PAID variant (TWINT/CARD)", () => {
  it("states payment was received and never mentions the seller for payment", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ paymentMethod: "TWINT", sellerName: "Anthony David" }),
    );
    expect(content.text).toMatch(/a bien été reçu/);
    expect(content.text).not.toMatch(/règlement.*auprès/i);
    expect(content.html).toMatch(/a bien été reçu/);
  });

  it("behaves identically for CARD as for TWINT (same variant)", () => {
    const twint = buildOrderConfirmationEmail(baseInput({ paymentMethod: "TWINT" }));
    const card = buildOrderConfirmationEmail(baseInput({ paymentMethod: "CARD" }));
    expect(twint.text.replace(/TWINT|CARD/g, "")).toBe(card.text.replace(/TWINT|CARD/g, ""));
  });
});

describe("buildOrderConfirmationEmail — SELLER PAYMENT variant", () => {
  it("states payment is still due and never implies the order is already paid", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ paymentMethod: "SELLER", sellerName: "Anthony David" }),
    );
    expect(content.text).toMatch(/se fera directement auprès/);
    expect(content.text).not.toMatch(/a bien été reçu/);
  });

  it("includes the seller's name when a seller is assigned", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ paymentMethod: "SELLER", sellerName: "Anthony David" }),
    );
    expect(content.text).toContain("auprès de Anthony David");
  });

  it("omits any seller name, without fabricating one, when unassigned", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ paymentMethod: "SELLER", sellerName: null }),
    );
    expect(content.text).not.toContain("Anthony David");
    expect(content.text).toMatch(/auprès du membre de Mélodia responsable de la livraison/);
  });
});

describe("buildOrderConfirmationEmail — content", () => {
  it("lists every product with quantity and line total", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    expect(content.text).toContain("2 × Chasselas — CHF 36.–");
    expect(content.text).toContain("3 × Pinot Noir — CHF 60.–");
    expect(content.text).toContain("1 × Carton découverte — CHF 100.–");
  });

  it("represents a bundle line item exactly as sold, by its own snapshot name/total, not its components", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    expect(content.text).toContain("Carton découverte");
    expect(content.text).not.toMatch(/component/i);
  });

  it("formats the order total using Swiss CHF formatting", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ order: { ...baseInput().order, totalAmount: 19600 } }),
    );
    expect(content.text).toContain("Total : CHF 196.–");
  });

  it("formats an amount with rappen correctly", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ items: [{ nameSnapshot: "Rosé", quantity: 1, lineTotalAmount: 1850 }] }),
    );
    expect(content.text).toContain("CHF 18.50");
  });

  it("includes the delivery address", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    expect(content.text).toContain("Rue du Lac 15");
    expect(content.text).toContain("1400 Yverdon-les-Bains");
  });

  it("includes the delivery note when present", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ order: { ...baseInput().order, deliveryNote: "Sonner deux fois." } }),
    );
    expect(content.text).toContain("Sonner deux fois.");
    expect(content.html).toContain("Sonner deux fois.");
  });

  it("omits any delivery-note section when absent", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ order: { ...baseInput().order, deliveryNote: null } }),
    );
    expect(content.text).not.toContain("Remarque :");
  });

  it("never invents a delivery date, carrier, tracking number, or pickup point", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    for (const forbidden of [
      /livr[ée] le/i,
      /suivi/i,
      /tracking/i,
      /point de retrait/i,
      /transporteur/i,
    ]) {
      expect(content.text).not.toMatch(forbidden);
      expect(content.html).not.toMatch(forbidden);
    }
  });

  it("never exposes an internal database ID or provider identifier", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    // Only the human order number (ECM-YYYY-NNNN) may appear as an identifier.
    expect(content.text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(content.html).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("never contains a provider transaction ID, TWINT identifier, or payment token/credential", () => {
    const content = buildOrderConfirmationEmail(baseInput({ paymentMethod: "TWINT" }));
    for (const forbidden of [
      /saferpay/i,
      /transactionid/i,
      /token/i,
      /card.?number/i,
      /cvv/i,
      /cvc/i,
    ]) {
      expect(content.text).not.toMatch(forbidden);
      expect(content.html).not.toMatch(forbidden);
    }
  });
});

describe("buildOrderConfirmationEmail — HTML escaping", () => {
  it("escapes a customer name containing HTML special characters", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({
        order: {
          ...baseInput().order,
          customerFirstName: "<img src=x onerror=alert(1)>",
          customerLastName: "O'Brien & Sons",
        },
      }),
    );
    expect(content.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(content.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(content.html).toContain("O&#39;Brien &amp; Sons");
  });

  it("escapes a delivery note containing a script tag", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({
        order: { ...baseInput().order, deliveryNote: "<script>alert('xss')</script>" },
      }),
    );
    expect(content.html).not.toContain("<script>alert('xss')</script>");
    expect(content.html).toContain("&lt;script&gt;");
  });

  it("escapes an address containing HTML special characters", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ order: { ...baseInput().order, customerAddress: "Rue <b>Test</b> 3" } }),
    );
    expect(content.html).not.toContain("<b>Test</b>");
    expect(content.html).toContain("&lt;b&gt;Test&lt;/b&gt;");
  });

  it("escapes a product name snapshot containing special characters", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({
        items: [{ nameSnapshot: 'Vin <rouge> & "spécial"', quantity: 1, lineTotalAmount: 1800 }],
      }),
    );
    expect(content.html).not.toContain("<rouge>");
    expect(content.html).toContain("&lt;rouge&gt;");
  });

  it("the plain-text output is never HTML-escaped", () => {
    const content = buildOrderConfirmationEmail(
      baseInput({ order: { ...baseInput().order, deliveryNote: "Sonner & attendre" } }),
    );
    expect(content.text).toContain("Sonner & attendre");
    expect(content.text).not.toContain("&amp;");
  });
});

describe("buildOrderConfirmationEmail — HTML/text consistency", () => {
  it("both outputs report the identical order total and item count derived from the same fields", () => {
    const content = buildOrderConfirmationEmail(baseInput());
    expect(content.text).toContain("CHF 196.–");
    expect(content.html).toContain("CHF 196.–");
    for (const name of ["Chasselas", "Pinot Noir", "Carton découverte"]) {
      expect(content.text).toContain(name);
      expect(content.html.replace(/&#39;/g, "'")).toContain(name);
    }
  });
});
