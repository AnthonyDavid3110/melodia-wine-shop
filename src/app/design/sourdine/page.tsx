import { Instrument_Serif, Work_Sans } from "next/font/google";
import type { Metadata } from "next";
import {
  explorationBundle,
  explorationCart,
  explorationWines,
  supportMelodia,
} from "../_data/content";
import { PlaceholderBottle } from "../_components/placeholder-bottle";
import { QuantityStepper } from "../_components/quantity-stepper";
import styles from "./sourdine.module.css";

export const metadata: Metadata = {
  title: "Sourdine — Design exploration",
};

// Instrument Serif ships weight 400 only (regular + italic) — the hero and
// headings below rely on size, italics and letter-spacing rather than a
// bold weight, which this face does not provide.
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-sourdine-display",
});

const interfaceFont = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sourdine-interface",
});

const bg = "#241318";
const cream = "#F1E7D8";
const gold = "#C9A66B";

export default function SourdineConceptPage() {
  return (
    <div
      className={`${display.variable} ${interfaceFont.variable}`}
      style={{
        backgroundColor: bg,
        color: cream,
        fontFamily: "var(--font-sourdine-interface)",
      }}
    >
      {/* Header / navigation */}
      <header className="sticky top-10 z-40 border-b border-white/10 bg-[#241318]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-white/50 uppercase">Les vins de</p>
            <p
              className="text-xl leading-none italic"
              style={{ fontFamily: "var(--font-sourdine-display)" }}
            >
              Mélodia
            </p>
          </div>
          <nav
            className="hidden items-center gap-6 text-sm font-light sm:flex"
            aria-label="Navigation principale"
          >
            <a href="#selection" className="hover:text-[#C9A66B]">
              La sélection
            </a>
            <a href="#carton" className="hover:text-[#C9A66B]">
              Carton découverte
            </a>
            <a href="#soutenir" className="hover:text-[#C9A66B]">
              Soutenir Mélodia
            </a>
          </nav>
          <button
            type="button"
            className="flex items-center gap-2 text-sm"
            style={{ color: gold }}
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
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium"
              style={{ backgroundColor: gold, color: bg }}
            >
              4
            </span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-8">
        <p className="text-xs tracking-[0.3em] uppercase" style={{ color: gold }}>
          Vente 2026
        </p>
        <h1
          className="mt-5 text-4xl leading-tight tracking-wide italic sm:text-5xl"
          style={{ fontFamily: "var(--font-sourdine-display)" }}
        >
          Les vins de Mélodia
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed font-light text-white/75">
          Découvrez notre sélection de vins et soutenez l&apos;Ensemble de Cuivres Mélodia,
          formation de catégorie Excellence.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href="#selection"
            className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium"
            style={{ backgroundColor: gold, color: bg }}
          >
            Découvrir la sélection
          </a>
          <a
            href="#soutenir"
            className="text-sm underline underline-offset-4"
            style={{ color: gold }}
          >
            Soutenir Mélodia
          </a>
        </div>
      </section>

      <svg
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className="block h-6 w-full"
        aria-hidden="true"
      >
        <path
          d="M0 4 C 100 24, 300 24, 400 4"
          fill="none"
          stroke={gold}
          strokeOpacity="0.5"
          strokeWidth="1"
        />
      </svg>

      {/* Wine showcase — paced, larger imagery, fewer per row */}
      <section id="selection" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <h2 className="text-2xl italic" style={{ fontFamily: "var(--font-sourdine-display)" }}>
          La sélection
        </h2>
        <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {explorationWines.map((wine) => (
            <div key={wine.id} className="flex flex-col items-center text-center">
              <div className={`${styles.spotlight} flex h-48 w-full items-center justify-center`}>
                <PlaceholderBottle
                  label={wine.name}
                  className="h-40 w-16"
                  style={{ color: cream }}
                />
              </div>
              <p
                className="mt-4 text-lg italic"
                style={{ fontFamily: "var(--font-sourdine-display)" }}
              >
                {wine.name}
              </p>
              <p className="mt-1 text-xs tracking-wide text-white/50 uppercase">
                {wine.producer} · {wine.region} · {wine.vintage}
              </p>
              <p className="mt-3 text-base tabular-nums" style={{ color: gold }}>
                {wine.priceLabel}
              </p>
              <button
                type="button"
                className="mt-4 rounded-full border px-5 py-2 text-xs tracking-wide uppercase"
                style={{ borderColor: gold, color: gold }}
              >
                Ajouter
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Discovery box — softly glowing alcove */}
      <section id="carton" className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <div
          className="rounded-2xl border px-6 py-10 text-center sm:px-10"
          style={{
            borderColor: "rgba(201,166,107,0.35)",
            backgroundColor: "rgba(201,166,107,0.06)",
          }}
        >
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: gold }}>
            Offre spéciale
          </p>
          <h3
            className="mt-2 text-2xl italic"
            style={{ fontFamily: "var(--font-sourdine-display)" }}
          >
            {explorationBundle.name}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed font-light text-white/75">
            {explorationBundle.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <p className="text-2xl tabular-nums" style={{ color: gold }}>
              {explorationBundle.priceLabel}
            </p>
            <p className="text-sm text-white/40 line-through">{explorationBundle.compareLabel}</p>
            <p className="text-sm text-white/70">{explorationBundle.savingsLabel}</p>
          </div>
          <button
            type="button"
            className="mt-6 inline-flex items-center rounded-full px-6 py-3 text-sm font-medium"
            style={{ backgroundColor: gold, color: bg }}
          >
            Ajouter le carton découverte
          </button>
        </div>
      </section>

      {/* Support Mélodia */}
      <section id="soutenir" className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
        <h2 className="text-2xl italic" style={{ fontFamily: "var(--font-sourdine-display)" }}>
          {supportMelodia.heading}
        </h2>
        <p className="mt-4 text-base leading-relaxed font-light text-white/75">
          {supportMelodia.body}
        </p>
        <a
          href="#"
          className="mt-5 inline-block text-sm underline underline-offset-4"
          style={{ color: gold }}
        >
          En savoir plus sur Mélodia
        </a>
      </section>

      {/* Cart preview + control sample */}
      <section className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <h2 className="text-xl italic" style={{ fontFamily: "var(--font-sourdine-display)" }}>
          Votre sélection{" "}
          <span className="text-sm font-normal text-white/50 not-italic">(aperçu)</span>
        </h2>
        <div
          className="mt-6 rounded-xl border px-6 py-6"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        >
          <ul className="flex flex-col gap-3">
            {explorationCart.items.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between border-b border-white/10 pb-3 text-sm font-light"
              >
                <span>
                  {item.name} <span className="text-white/40">× {item.quantity}</span>
                </span>
                <span className="tabular-nums">{item.lineTotalLabel}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-base font-medium">
            <span>Total</span>
            <span className="tabular-nums" style={{ color: gold }}>
              {explorationCart.totalLabel}
            </span>
          </div>
          <button
            type="button"
            className="mt-5 w-full rounded-full py-3 text-sm font-medium"
            style={{ backgroundColor: gold, color: bg }}
          >
            Commander
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-8">
          <div
            className="flex items-center gap-3 rounded-full border px-3 py-1"
            style={{ borderColor: gold }}
          >
            <QuantityStepper
              label="Chasselas"
              wrapperClassName="flex items-center gap-3"
              buttonClassName="flex h-7 w-7 items-center justify-center rounded-full text-base"
              valueClassName="w-6 text-center text-sm tabular-nums"
            />
          </div>
          <label className="flex flex-col gap-1 text-xs tracking-wide text-white/60 uppercase">
            Membre Mélodia (optionnel)
            <select
              className="rounded-full border bg-transparent px-4 py-2 text-sm text-[#F1E7D8]"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
              defaultValue=""
            >
              <option className="text-black" value="">
                Aucun membre sélectionné
              </option>
              <option className="text-black" value="exemple">
                Exemple : J. Dupont
              </option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
