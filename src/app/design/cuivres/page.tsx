import { Inter } from "next/font/google";
import type { Metadata } from "next";
import {
  explorationBundle,
  explorationCart,
  explorationWines,
  supportMelodia,
} from "../_data/content";
import { PlaceholderBottle } from "../_components/placeholder-bottle";
import { QuantityStepper } from "../_components/quantity-stepper";

export const metadata: Metadata = {
  title: "Cuivres — Design exploration",
};

const interfaceFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cuivres",
});

const bg = "#F5F5F2";
const ink = "#111111";
const red = "#C8102E";

export default function CuivresConceptPage() {
  return (
    <div
      className={interfaceFont.variable}
      style={{ backgroundColor: bg, color: ink, fontFamily: "var(--font-cuivres)" }}
    >
      {/* Header / navigation */}
      <header className="sticky top-10 z-40 border-b-2 border-black bg-[#F5F5F2]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3" style={{ backgroundColor: red }} aria-hidden="true" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase">Mélodia</span>
          </div>
          <nav
            className="hidden items-center gap-8 text-xs font-semibold tracking-[0.15em] uppercase sm:flex"
            aria-label="Navigation principale"
          >
            <a href="#selection" className="hover:text-[#C8102E]">
              Vins
            </a>
            <a href="#carton" className="hover:text-[#C8102E]">
              Carton découverte
            </a>
            <a href="#soutenir" className="hover:text-[#C8102E]">
              Soutenir
            </a>
          </nav>
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase"
            aria-label="Voir le panier, 4 articles"
          >
            Panier
            <span
              className="flex h-5 min-w-5 items-center justify-center px-1 text-[11px] font-bold text-white"
              style={{ backgroundColor: red }}
            >
              4
            </span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-12 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: red }}>
          Vente 2026
        </p>
        <h1 className="mt-3 text-4xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl md:text-7xl">
          Les vins de
          <br />
          Mélodia
        </h1>
        <div className="mt-6 h-[3px] w-24" style={{ backgroundColor: red }} aria-hidden="true" />
        <p className="mt-6 max-w-md text-sm leading-relaxed text-black/70">
          Découvrez notre sélection de vins et soutenez l&apos;Ensemble de Cuivres Mélodia,
          formation de catégorie Excellence.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="#selection"
            className="inline-flex items-center bg-black px-6 py-3 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Découvrir les vins
          </a>
          <a
            href="#soutenir"
            className="text-xs font-semibold tracking-wide uppercase underline underline-offset-4"
            style={{ color: red }}
          >
            Soutenir Mélodia
          </a>
        </div>
      </section>

      {/* Wine grid */}
      <section id="selection" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-black/60 uppercase">
          La sélection
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-px bg-black/15 sm:grid-cols-3">
          {explorationWines.map((wine) => (
            <div key={wine.id} className="flex flex-col bg-[#F5F5F2] p-4">
              <div className="relative flex aspect-[3/4] items-center justify-center bg-[#E8E8E4]">
                <PlaceholderBottle label={wine.name} className="h-24 w-10 text-black/70" />
                <span
                  className="absolute top-2 right-2 border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{ borderColor: red, color: red }}
                >
                  {wine.priceLabel}
                </span>
              </div>
              <p className="mt-3 text-[10px] tracking-wide text-black/50 uppercase">
                Photo à venir
              </p>
              <p className="mt-2 text-sm font-bold tracking-wide uppercase">{wine.name}</p>
              <p className="mt-0.5 text-xs text-black/60">
                {wine.region} · {wine.vintage} · {wine.color}
              </p>
              <button
                type="button"
                className="mt-3 self-start text-xs font-semibold tracking-wide uppercase"
              >
                Ajouter →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Discovery box — inverted block for contrast */}
      <section id="carton" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="bg-black px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: red }}>
            Offre spéciale
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight uppercase">
            {explorationBundle.name}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
            {explorationBundle.description}
          </p>
          <table className="mt-6 w-full max-w-sm text-sm">
            <tbody>
              <tr className="border-b border-white/20">
                <td className="py-2 text-white/70">Bouteilles</td>
                <td className="py-2 text-right tabular-nums">{explorationBundle.bottleCount}</td>
              </tr>
              <tr className="border-b border-white/20">
                <td className="py-2 text-white/70">Prix à l&apos;unité</td>
                <td className="py-2 text-right tabular-nums">{explorationBundle.compareLabel}</td>
              </tr>
              <tr>
                <td className="py-2 font-bold">Prix du carton</td>
                <td className="py-2 text-right text-lg font-bold tabular-nums">
                  {explorationBundle.priceLabel}
                </td>
              </tr>
            </tbody>
          </table>
          <button
            type="button"
            className="mt-6 inline-flex items-center bg-white px-6 py-3 text-xs font-semibold tracking-wide text-black uppercase"
          >
            Ajouter le carton découverte
          </button>
        </div>
      </section>

      {/* Support Mélodia */}
      <section id="soutenir" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-8 border-t-2 border-black pt-8 sm:grid-cols-[auto_1fr]">
          <p className="text-5xl font-extrabold" style={{ color: red }}>
            01
          </p>
          <div>
            <h2 className="text-lg font-bold tracking-wide uppercase">{supportMelodia.heading}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-black/70">
              {supportMelodia.body}
            </p>
          </div>
        </div>
      </section>

      {/* Cart preview + control sample */}
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-black/60 uppercase">
          Panier <span className="font-normal">(aperçu)</span>
        </h2>
        <table className="mt-4 w-full border-t-2 border-black text-sm">
          <thead>
            <tr className="border-b border-black/20 text-left text-xs tracking-wide text-black/50 uppercase">
              <th className="py-2 font-semibold">Produit</th>
              <th className="py-2 text-right font-semibold">Qté</th>
              <th className="py-2 text-right font-semibold">Prix</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {explorationCart.items.map((item) => (
              <tr key={item.name} className="border-b border-black/10">
                <td className="py-2.5">{item.name}</td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{item.unitPriceLabel}</td>
                <td className="py-2.5 text-right tabular-nums">{item.lineTotalLabel}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="py-3" colSpan={3}>
                Total
              </td>
              <td className="py-3 text-right tabular-nums">{explorationCart.totalLabel}</td>
            </tr>
          </tfoot>
        </table>
        <button
          type="button"
          className="mt-5 w-full bg-black py-3 text-xs font-semibold tracking-wide text-white uppercase"
        >
          Commander
        </button>

        <div className="mt-8 flex flex-wrap items-center gap-8">
          <QuantityStepper
            label="Chasselas"
            wrapperClassName="flex items-center gap-0 border-2 border-black"
            buttonClassName="flex h-9 w-9 items-center justify-center text-lg font-bold hover:bg-black hover:text-white"
            valueClassName="w-8 text-center text-sm font-semibold tabular-nums"
          />
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-black/70 uppercase">
            Membre Mélodia (optionnel)
            <select
              className="border-2 border-black bg-[#F5F5F2] px-3 py-2 text-sm font-normal text-black normal-case"
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
