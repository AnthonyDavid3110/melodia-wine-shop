/**
 * PLACEHOLDER CONTENT — Phase 1 design exploration only.
 *
 * Fictional wines, producers and prices used solely to compare the three
 * visual directions on equal footing. None of this is real campaign data.
 * Do not carry this data forward into production catalogue/domain code.
 */

export type ExplorationWineColor = "blanc" | "rouge" | "rosé";

export interface ExplorationWine {
  id: string;
  name: string;
  producer: string;
  region: string;
  vintage: number;
  color: ExplorationWineColor;
  priceLabel: string;
}

export const explorationWines: ExplorationWine[] = [
  {
    id: "chasselas",
    name: "Chasselas",
    producer: "Domaine des Coteaux",
    region: "Vaud",
    vintage: 2025,
    color: "blanc",
    priceLabel: "CHF 18.–",
  },
  {
    id: "chardonnay",
    name: "Chardonnay",
    producer: "Domaine Sainte-Agnès",
    region: "Valais",
    vintage: 2025,
    color: "blanc",
    priceLabel: "CHF 21.–",
  },
  {
    id: "oeil-de-perdrix",
    name: "Œil-de-Perdrix",
    producer: "Cave des Vernes",
    region: "Neuchâtel",
    vintage: 2025,
    color: "rosé",
    priceLabel: "CHF 19.–",
  },
  {
    id: "pinot-noir",
    name: "Pinot Noir",
    producer: "Domaine de la Ronde",
    region: "Vaud",
    vintage: 2024,
    color: "rouge",
    priceLabel: "CHF 22.–",
  },
  {
    id: "gamaret",
    name: "Gamaret",
    producer: "Cave du Manoir",
    region: "Genève",
    vintage: 2024,
    color: "rouge",
    priceLabel: "CHF 24.–",
  },
  {
    id: "merlot",
    name: "Merlot",
    producer: "Domaine du Clocher",
    region: "Valais",
    vintage: 2023,
    color: "rouge",
    priceLabel: "CHF 26.–",
  },
];

export const explorationBundle = {
  name: "Carton découverte",
  description: "Une bouteille de chacun des six vins de la sélection 2026.",
  bottleCount: 6,
  priceLabel: "CHF 120.–",
  compareLabel: "CHF 130.– à l'unité",
  savingsLabel: "Vous économisez CHF 10.–",
};

export const explorationCart = {
  items: [
    {
      name: "Chasselas — Domaine des Coteaux",
      quantity: 2,
      unitPriceLabel: "CHF 18.–",
      lineTotalLabel: "CHF 36.–",
    },
    {
      name: "Pinot Noir — Domaine de la Ronde",
      quantity: 1,
      unitPriceLabel: "CHF 22.–",
      lineTotalLabel: "CHF 22.–",
    },
    {
      name: "Carton découverte",
      quantity: 1,
      unitPriceLabel: "CHF 120.–",
      lineTotalLabel: "CHF 120.–",
    },
  ],
  totalLabel: "CHF 178.–",
};

export const supportMelodia = {
  heading: "Soutenir Mélodia",
  body: "Chaque bouteille achetée finance les répétitions, les concerts et les déplacements en concours de l'Ensemble de Cuivres Mélodia, formation de catégorie Excellence.",
};
