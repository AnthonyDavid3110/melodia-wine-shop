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
import styles from "./programme.module.css";

export const metadata: Metadata = {
  title: "Programme — Design exploration",
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

export default function ProgrammeConceptPage() {
  return (
    <div
      className={`${display.variable} ${interfaceFont.variable}`}
      style={{
        backgroundColor: paper,
        color: ink,
        fontFamily: "var(--font-programme-interface)",
      }}
    >
      {/* Header / navigation */}
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

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: oxblood }}>
            Vente 2026 · N°01
          </p>
          <h1
            className="mt-4 text-4xl leading-[1.05] sm:text-5xl"
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
              className="inline-flex items-center px-6 py-3 text-sm text-[#F4EEE4]"
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
        <div className="flex flex-col items-center">
          <PlaceholderBottle
            label="Sélection 2026"
            className="h-56 w-auto sm:h-72"
            style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
          />
          <p className="mt-3 text-xs tracking-[0.2em] text-black/50 uppercase">
            Sélection 2026 — photo provisoire
          </p>
        </div>
      </section>

      <div className={styles.barline} aria-hidden="true" />

      {/* Wine selection, presented as numbered programme entries */}
      <section id="selection" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-programme-display)" }}>
          La sélection
        </h2>
        <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {explorationWines.map((wine, index) => (
            <li key={wine.id} className="flex gap-4 border-t border-black/10 pt-5">
              <PlaceholderBottle
                label={wine.name}
                className="h-20 w-8 shrink-0"
                style={{ color: ink, filter: "sepia(0.35) contrast(1.05)" }}
              />
              <div className="flex-1">
                <p className="text-xs text-black/45 tabular-nums">
                  N°{String(index + 1).padStart(2, "0")}
                </p>
                <p className="text-lg" style={{ fontFamily: "var(--font-programme-display)" }}>
                  {wine.name}
                </p>
                <p className="mt-0.5 text-xs tracking-wide text-black/55 uppercase">
                  {wine.producer} · {wine.region} · {wine.vintage} · {wine.color}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-base font-medium tabular-nums">{wine.priceLabel}</p>
                  <button
                    type="button"
                    className="border px-3 py-1.5 text-xs tracking-wide uppercase"
                    style={{ borderColor: ink }}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.barline} aria-hidden="true" />

      {/* Discovery box — distinct featured framing */}
      <section id="carton" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <div className="border-y-2 px-6 py-10 sm:px-10" style={{ borderColor: oxblood }}>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: oxblood }}>
            Offre spéciale
          </p>
          <h3 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-programme-display)" }}>
            {explorationBundle.name}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-black/75">
            {explorationBundle.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <p className="text-2xl font-medium tabular-nums">{explorationBundle.priceLabel}</p>
            <p className="text-sm text-black/55 line-through">{explorationBundle.compareLabel}</p>
            <p className="text-sm" style={{ color: oxblood }}>
              {explorationBundle.savingsLabel}
            </p>
          </div>
          <button
            type="button"
            className="mt-6 inline-flex items-center px-6 py-3 text-sm text-[#F4EEE4]"
            style={{ backgroundColor: ink }}
          >
            Ajouter le carton découverte
          </button>
        </div>
      </section>

      {/* Support Mélodia */}
      <section id="soutenir" className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
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
        <a
          href="#"
          className="mt-5 inline-block text-sm underline underline-offset-4"
          style={{ color: oxblood }}
        >
          En savoir plus sur Mélodia
        </a>
      </section>

      <div className={styles.barline} aria-hidden="true" />

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
            className="mt-5 w-full py-3 text-sm text-[#F4EEE4]"
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
