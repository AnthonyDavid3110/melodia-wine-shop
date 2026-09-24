import { describe, expect, it } from "vitest";
import { buildOrdersCsv, type OrderExportRow } from "./build-orders-csv";
import { parseCsvDocument } from "./csv-test-utils";
import type { PaymentAttemptForExportSelection } from "./select-authoritative-payment-for-export";

function payment(
  overrides: Partial<PaymentAttemptForExportSelection> & { id: string },
): PaymentAttemptForExportSelection {
  return {
    method: "SELLER",
    provider: "OFFLINE",
    providerPaymentId: null,
    status: "PENDING",
    paidAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function baseOrder(overrides: Partial<OrderExportRow> = {}): OrderExportRow {
  return {
    orderNumber: "ECM-2026-0001",
    createdAt: new Date("2026-09-15T10:00:00Z"),
    source: "ONLINE",
    status: "CONFIRMED",
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    customerEmail: "jean@example.ch",
    customerPhone: "+41 79 123 45 67",
    deliveryNote: null,
    sellerName: "Anne Bornand",
    totalAmount: 19600,
    customerPaymentStatus: "PAID",
    sellerSettlementStatus: "NOT_APPLICABLE",
    payments: [],
    ...overrides,
  };
}

describe("buildOrdersCsv", () => {
  it("produces the exact deterministic header order", () => {
    const { header } = parseCsvDocument(buildOrdersCsv([]));
    expect(header).toEqual([
      "numeroCommande",
      "dateCreation",
      "source",
      "statut",
      "client",
      "adresse",
      "npa",
      "localite",
      "email",
      "telephone",
      "noteLivraison",
      "vendeur",
      "montantTotalCHF",
      "modePaiement",
      "statutPaiementClient",
      "fournisseur",
      "referenceFournisseur",
      "datePaiement",
      "statutReglementVendeur",
    ]);
  });

  it("produces one row per order with correct human identifiers and money", () => {
    const succeeded = payment({
      id: "pay-1",
      method: "TWINT",
      provider: "SAFERPAY",
      providerPaymentId: "SP-TX-123",
      status: "SUCCEEDED",
      paidAt: new Date("2026-09-15T11:00:00Z"),
    });
    const { rows } = parseCsvDocument(buildOrdersCsv([baseOrder({ payments: [succeeded] })]));
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row![0]).toBe("ECM-2026-0001");
    expect(row![1]).toBe("2026-09-15");
    expect(row![2]).toBe("En ligne");
    expect(row![3]).toBe("Confirmée");
    expect(row![4]).toBe("Jean Dupont");
    expect(row![11]).toBe("Anne Bornand");
    expect(row![12]).toBe("196.00");
    expect(row![13]).toBe("TWINT");
    expect(row![14]).toBe("Payée");
    expect(row![15]).toBe("SAFERPAY");
    expect(row![16]).toBe("SP-TX-123");
    expect(row![17]).toBe("2026-09-15 13:00");
    expect(row![18]).toBe("Non applicable");
  });

  it("never leaks a raw order UUID anywhere in the output", () => {
    const uuidLike = "5f1e6b3a-2c4d-4e5f-8a9b-1c2d3e4f5a6b";
    const doc = buildOrdersCsv([baseOrder()]);
    expect(doc).not.toContain(uuidLike);
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("shows 'Non attribuée' for an order with no seller", () => {
    const { rows } = parseCsvDocument(buildOrdersCsv([baseOrder({ sellerName: null })]));
    expect(rows[0]![11]).toBe("Non attribuée");
  });

  it("includes a CANCELLED order with its explicit status (approved §6)", () => {
    const { rows } = parseCsvDocument(
      buildOrdersCsv([baseOrder({ status: "CANCELLED", customerPaymentStatus: "REFUNDED" })]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]![3]).toBe("Annulée");
    expect(rows[0]![14]).toBe("Remboursée");
  });

  it("leaves payment-attempt columns empty when no payment row exists", () => {
    const { rows } = parseCsvDocument(buildOrdersCsv([baseOrder({ payments: [] })]));
    const row = rows[0]!;
    expect(row[13]).toBe(""); // modePaiement
    expect(row[15]).toBe(""); // fournisseur
    expect(row[16]).toBe(""); // referenceFournisseur
    expect(row[17]).toBe(""); // datePaiement
  });

  it("neutralizes a formula-injection attempt in the customer name without breaking escaping", () => {
    const doc = buildOrdersCsv([
      baseOrder({ customerFirstName: "=cmd", customerLastName: "|calc" }),
    ]);
    const { rows } = parseCsvDocument(doc);
    expect(rows[0]![4]).toBe("'=cmd |calc");
  });

  it("customerPaymentStatus and sellerSettlementStatus come from the order, never a payment row", () => {
    // A SELLER-payment order still PENDING at the order level, even
    // though the (single) Payment row happens to already be SUCCEEDED
    // in this synthetic fixture — the order-level field must win.
    const { rows } = parseCsvDocument(
      buildOrdersCsv([
        baseOrder({
          customerPaymentStatus: "PENDING",
          sellerSettlementStatus: "PENDING",
          payments: [payment({ id: "p1", method: "SELLER", status: "SUCCEEDED" })],
        }),
      ]),
    );
    expect(rows[0]![14]).toBe("En attente");
    expect(rows[0]![18]).toBe("En attente");
  });
});
