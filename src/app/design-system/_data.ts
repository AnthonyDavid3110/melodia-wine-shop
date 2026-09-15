/**
 * PLACEHOLDER CONTENT — /design-system demo only.
 *
 * Static, fictional data used to give the foundation representative
 * compositions to render. Not campaign data, not connected to any
 * domain/database model. Do not import this outside /design-system.
 */

export const demoWines = [
  {
    id: "chasselas",
    number: "01",
    name: "Chasselas",
    producer: "Domaine des Coteaux",
    region: "Vaud",
    vintage: 2025,
    color: "Blanc" as const,
    description: "Un blanc vif et minéral, parfait à l'apéritif.",
    priceLabel: "CHF 18.–",
  },
  {
    id: "pinot-noir",
    number: "02",
    name: "Pinot Noir",
    producer: "Domaine de la Ronde",
    region: "Vaud",
    vintage: 2024,
    color: "Rouge" as const,
    description: "Souple et élégant, le rouge le plus polyvalent de la sélection.",
    priceLabel: "CHF 22.–",
  },
  {
    id: "oeil-de-perdrix",
    number: "03",
    name: "Œil-de-Perdrix",
    producer: "Cave des Vernes",
    region: "Neuchâtel",
    vintage: 2025,
    color: "Rosé" as const,
    description: "Un rosé délicat aux notes de fruits rouges.",
    priceLabel: "CHF 19.–",
  },
];

export const demoCart = {
  items: [
    { id: "1", name: "Chasselas — Domaine des Coteaux", quantity: 2, lineTotalLabel: "CHF 36.–" },
    { id: "2", name: "Pinot Noir — Domaine de la Ronde", quantity: 1, lineTotalLabel: "CHF 22.–" },
    { id: "3", name: "Carton découverte", quantity: 1, lineTotalLabel: "CHF 120.–" },
  ],
  totalLabel: "CHF 178.–",
};

const firstNames = [
  "Anne",
  "Marc",
  "Sophie",
  "Julien",
  "Claire",
  "Nicolas",
  "Laure",
  "Thomas",
  "Camille",
  "David",
  "Elise",
  "Fabien",
  "Isabelle",
  "Louis",
  "Marie",
  "Olivier",
  "Sarah",
  "Vincent",
  "Chloé",
  "Yann",
];
const lastNames = [
  "Bornand",
  "Currat",
  "Delacroix",
  "Egger",
  "Favre",
  "Girod",
  "Humbert",
  "Jaccoud",
  "Keller",
  "Lambert",
  "Monney",
  "Noverraz",
  "Oberson",
  "Piguet",
  "Quennoz",
  "Rossier",
  "Savary",
  "Torche",
  "Udriot",
  "Vionnet",
];

/** ~70 fictional members — enough to demonstrate the combobox at the scale docs/07-DESIGN-SYSTEM.md §36 requires. */
export const demoSellers = firstNames.flatMap((first, i) => {
  const count = i % 2 === 0 ? 4 : 3;
  return Array.from({ length: count }, (_, j) => {
    const last = lastNames[(i * 3 + j) % lastNames.length]!;
    return { value: `${first}-${last}`.toLowerCase(), label: `${first} ${last}` };
  });
});

export type DemoOrderStatus =
  "NEW" | "CONFIRMED" | "PREPARED" | "HANDED_TO_SELLER" | "DELIVERED" | "CANCELLED";
export type DemoPaymentStatus = "PENDING" | "PAID" | "REFUNDED";
export type DemoSettlementStatus = "NOT_APPLICABLE" | "PENDING" | "SETTLED";

export const demoOrders: Array<{
  number: string;
  customer: string;
  seller: string | null;
  total: string;
  status: DemoOrderStatus;
  payment: DemoPaymentStatus;
  settlement: DemoSettlementStatus;
}> = [
  {
    number: "ECM-2026-0142",
    customer: "Sophie Delacroix",
    seller: "Marc Favre",
    total: "CHF 96.–",
    status: "DELIVERED",
    payment: "PAID",
    settlement: "SETTLED",
  },
  {
    number: "ECM-2026-0143",
    customer: "Julien Keller",
    seller: null,
    total: "CHF 42.–",
    status: "CONFIRMED",
    payment: "PENDING",
    settlement: "NOT_APPLICABLE",
  },
  {
    number: "ECM-2026-0144",
    customer: "Anne Rossier",
    seller: "Claire Girod",
    total: "CHF 178.–",
    status: "PREPARED",
    payment: "PAID",
    settlement: "PENDING",
  },
  {
    number: "ECM-2026-0145",
    customer: "Nicolas Piguet",
    seller: "Thomas Bornand",
    total: "CHF 60.–",
    status: "HANDED_TO_SELLER",
    payment: "PAID",
    settlement: "PENDING",
  },
  {
    number: "ECM-2026-0146",
    customer: "Isabelle Monney",
    seller: null,
    total: "CHF 24.–",
    status: "CANCELLED",
    payment: "REFUNDED",
    settlement: "NOT_APPLICABLE",
  },
];
