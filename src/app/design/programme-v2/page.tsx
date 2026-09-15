import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import type { Metadata } from "next";
import {
  explorationBundle,
  explorationCart,
  explorationWines,
  supportMelodia,
} from "../_data/content";
import { PlaceholderBottle } from "../_components/placeholder-bottle";
import { QuantityStepper } from "../_components/quantity-stepper";
import barlineStyles from "../programme/programme.module.css";
import styles from "./programme-v2.module.css";

export const metadata: Metadata = {
  title: "Programme V2 — Design exploration",
};

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-programme-display",
});

const interfaceFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-programme-interface",
});

const ink = "#1B1712";
const paper = "#F4EEE4";
const oxblood = "#7A2E2E";
const plate = "#EEDFC4";

// Short evocative descriptors, added only in this V2 refinement to give the
// wine plates editorial weight — not part of the shared exploration content,
// since V1/Cuivres/Sourdine intentionally kept identical content for a fair
// three-way comparison that is now settled.
const wineDescriptors: Record<string, string> = {
  chasselas: "Un blanc vif et minéral, parfait à l'apéritif.",
  chardonnay: "Rond et fruité, avec une belle longueur en bouche.",
  "oeil-de-perdrix": "Un rosé délicat aux notes de fruits rouges.",
  "pinot-noir": "Souple et élégant, le rouge le plus polyvalent de la sélection.",
  gamaret: "Charpenté et épicé, pour les repas les plus généreux.",
  merlot: "Ample et velouté, à laisser respirer avant de servir.",
};

export default function ProgrammeV2ConceptPage() {
  return (
    <div
      className={`${display.variable} ${interfaceFont.variable}`}
      style={{
        backgroundColor: paper,
        color: ink,
        fontFamily: "var(--font-programme-interface)",
      }}
    >
      {/* Header / navigation — unchanged from Programme V1, kept for family continuity */}
      <header className="sticky top-10 z-40 border-b border-black/10 bg-[#F4EEE4]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div style={{ fontFamily: "var(--font-programme-display)" }}>
            <p className="text-[10px] tracking-[0.25em] text-black/60 uppercase">Les vins de</p>
            <p className="text-xl leading-none">Mélodia</p>
          </div>
          <nav
            className="hidden items-center gap-6 text-sm sm:flex"
            aria-label="Navigation principale"
          >
            <a href="#selection" className="hover:underline">
              La sélection
            </a>
            <a href="#carton" className="hover:underline">
              Carton découverte
            </a>
            <a href="#soutenir" className="hover:underline">
              Soutenir Mélodia
            </a>
          </nav>
          <button
            type="button"
            className="relative flex items-center gap-2 text-sm"
            aria-label="Voir le panier, 4 articles"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h2l1.5 11.5A2 2 0 0 0 9.5 19h8a2 2 0 0 0 2-1.8L21 8H7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="21" r="1.2" fill="currentColor" />
              <circle cx="17" cy="21" r="1.2" fill="currentColor" />
            </svg>
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] text-[#F4EEE4]"
              style={{ backgroundColor: oxblood }}
            >
              4
            </span>
          </button>
        </div>
      </header>

      {/* Hero — photography as a major editorial element, not a small
          placeholder floating in space. A warm sand-toned plate bleeds to
          the viewport edge on desktop and leads the composition on mobile. */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-y-0 right-0 w-full md:w-[54%]"
          style={{ backgroundColor: plate }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 md:items-center md:py-14">
          <div className="relative order-2 md:order-1">
            <span
              className={`${styles.ghostNumeral} -top-10 -left-2 hidden text-[11rem] md:block`}
              style={{ fontFamily: "var(--font-programme-display)" }}
              aria-hidden="true"
            >
              01
            </span>
            <div className="relative">
              <p className="text-xs tracking-[0.3em] uppercase" style={{ color: oxblood }}>
                Vente 2026 · Ensemble de Cuivres Mélodia
              </p>
              <h1
                className="mt-4 text-4xl leading-[1.05] sm:text-5xl md:text-6xl"
                style={{ fontFamily: "var(--font-programme-display)" }}
              >
                Les vins
                <br />
                de Mélodia
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-black/75">
                Découvrez notre sélection de vins et soutenez l&apos;Ensemble de Cuivres Mélodia,
                formation de catégorie Excellence.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href="#selection"
                  className="inline-flex items-center px-7 py-3.5 text-sm font-medium text-[#F4EEE4]"
                  style={{ backgroundColor: ink }}
                >
                  Découvrir les vins
                </a>
                <a
                  href="#soutenir"
                  className="text-sm underline underline-offset-4"
                  style={{ color: oxblood }}
                >
                  Soutenir Mélodia
                </a>
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div
              className={`${styles.warmVignette} flex items-end justify-center gap-6 py-6 sm:gap-10 sm:py-10`}
            >
              <PlaceholderBottle
                label="Chasselas"
                className="h-40 w-16 sm:h-52 sm:w-20"
                style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
              />
              <PlaceholderBottle
                label="Pinot Noir"
                className="h-52 w-20 sm:h-64 sm:w-24"
                style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
              />
              <PlaceholderBottle
                label="Œil-de-Perdrix"
                className="h-36 w-14 sm:h-44 sm:w-18"
                style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
              />
            </div>
            <p className="pb-8 text-center text-xs tracking-[0.2em] text-black/50 uppercase sm:pb-12">
              Planche I · Sélection 2026 — photo provisoire
            </p>
          </div>
        </div>
      </section>

      <div className={barlineStyles.barline} aria-hidden="true" />

      {/* Wine selection — each wine as an editorial plate, alternating sides,
          with the bottle photography given real visual weight. */}
      <section id="selection" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-programme-display)" }}>
            La sélection
          </h2>
          <p className="text-xs tracking-[0.2em] text-black/45 uppercase">Six vins</p>
        </div>

        <div className="mt-6">
          {explorationWines.map((wine, index) => {
            const number = String(index + 1).padStart(2, "0");
            const imageFirst = index % 2 === 0;

            return (
              <div
                key={wine.id}
                className="grid items-center gap-6 border-t border-black/10 py-10 md:grid-cols-2 md:gap-14"
              >
                <div className={imageFirst ? "order-1" : "order-1 md:order-2"}>
                  <div
                    className={`${styles.warmVignette} relative flex h-56 items-center justify-center sm:h-64`}
                    style={{ backgroundColor: plate }}
                  >
                    <PlaceholderBottle
                      label={wine.name}
                      className="h-40 w-16 sm:h-48 sm:w-[4.5rem]"
                      style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
                    />
                  </div>
                  <p className="mt-2 text-xs tracking-[0.2em] text-black/45 uppercase">
                    Pl. {number} — photo provisoire
                  </p>
                </div>

                <div className={imageFirst ? "order-2" : "order-2 md:order-1"}>
                  <p className="text-xs tracking-[0.2em] text-black/45 uppercase">
                    N°{number} · {wine.color}
                  </p>
                  <p
                    className="mt-1 text-3xl"
                    style={{ fontFamily: "var(--font-programme-display)" }}
                  >
                    {wine.name}
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-black/55 uppercase">
                    {wine.producer} · {wine.region} · {wine.vintage}
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/70 italic">
                    {wineDescriptors[wine.id]}
                  </p>
                  <div className="mt-5 flex items-center gap-5">
                    <p className="text-xl font-medium tabular-nums">{wine.priceLabel}</p>
                    <button
                      type="button"
                      className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-[#F4EEE4]"
                      style={{ backgroundColor: ink }}
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className={barlineStyles.barline} aria-hidden="true" />

      {/* Discovery box — the strongest editorial moment on the page, on
          purpose: a full-width oxblood band, not another product row. */}
      <section id="carton" className="relative py-16" style={{ backgroundColor: oxblood }}>
        <div className="mx-auto max-w-5xl px-5 text-[#F4EEE4] sm:px-8">
          <div className="border-y-2 border-[#F4EEE4]/40 py-10">
            <p className="text-xs tracking-[0.3em] text-[#F4EEE4]/80 uppercase">Offre spéciale</p>
            <div className="mt-4 grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <h3
                  className="text-3xl sm:text-4xl"
                  style={{ fontFamily: "var(--font-programme-display)" }}
                >
                  {explorationBundle.name}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#F4EEE4]/85">
                  {explorationBundle.description}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <p className="text-3xl font-medium tabular-nums">
                    {explorationBundle.priceLabel}
                  </p>
                  <p className="text-sm text-[#F4EEE4]/80 line-through">
                    {explorationBundle.compareLabel}
                  </p>
                  <p className="text-sm text-[#F4EEE4]/90">{explorationBundle.savingsLabel}</p>
                </div>
                <button
                  type="button"
                  className="mt-7 inline-flex items-center px-7 py-3.5 text-sm font-medium"
                  style={{ backgroundColor: paper, color: ink }}
                >
                  Ajouter le carton découverte
                </button>
              </div>
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                {explorationWines.map((wine) => (
                  <PlaceholderBottle
                    key={wine.id}
                    label={wine.name}
                    className="h-24 w-9 text-[#F4EEE4] sm:h-32 sm:w-11"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Mélodia — a stronger narrative bridge from purchase to impact */}
      <section id="soutenir" className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
        <p
          className="text-4xl leading-none"
          style={{ fontFamily: "var(--font-programme-display)", color: oxblood }}
          aria-hidden="true"
        >
          «
        </p>
        <h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-programme-display)" }}>
          {supportMelodia.heading}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-black/75">{supportMelodia.body}</p>

        <div className="mt-9 grid grid-cols-1 gap-6 border-t border-black/10 pt-8 text-left sm:grid-cols-3 sm:text-center">
          {[
            { numeral: "I", label: "Répétitions" },
            { numeral: "II", label: "Concerts" },
            { numeral: "III", label: "Déplacements en concours" },
          ].map((item) => (
            <div key={item.label}>
              <p
                className="text-sm"
                style={{ fontFamily: "var(--font-programme-display)", color: oxblood }}
              >
                {item.numeral}
              </p>
              <p className="mt-1 text-sm text-black/70">{item.label}</p>
            </div>
          ))}
        </div>

        <a
          href="#"
          className="mt-8 inline-block text-sm underline underline-offset-4"
          style={{ color: oxblood }}
        >
          En savoir plus sur Mélodia
        </a>
      </section>

      <div className={barlineStyles.barline} aria-hidden="true" />

      {/* Cart preview + control sample */}
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <h2 className="text-xl" style={{ fontFamily: "var(--font-programme-display)" }}>
          Aperçu du panier <span className="text-sm font-normal text-black/50">(maquette)</span>
        </h2>
        <div className="mt-6 border border-black/15 p-6">
          <ul className="flex flex-col gap-3">
            {explorationCart.items.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between border-b border-dotted border-black/25 pb-3 text-sm"
              >
                <span>
                  {item.name} <span className="text-black/50">× {item.quantity}</span>
                </span>
                <span className="tabular-nums">{item.lineTotalLabel}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-base font-medium">
            <span>Total</span>
            <span className="tabular-nums">{explorationCart.totalLabel}</span>
          </div>
          <button
            type="button"
            className="mt-5 w-full py-3.5 text-sm font-medium text-[#F4EEE4]"
            style={{ backgroundColor: ink }}
          >
            Commander
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-8">
          <QuantityStepper
            label="Chasselas"
            wrapperClassName="flex items-center gap-3 border border-black/20 px-2 py-1"
            buttonClassName="flex h-8 w-8 items-center justify-center text-lg"
            valueClassName="w-6 text-center tabular-nums"
          />
          <label className="flex flex-col gap-1 text-xs tracking-wide text-black/60 uppercase">
            Membre Mélodia (optionnel)
            <select
              className="border border-black/20 bg-transparent px-3 py-2 text-sm text-black"
              defaultValue=""
            >
              <option value="">Aucun membre sélectionné</option>
              <option value="exemple">Exemple : J. Dupont</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
