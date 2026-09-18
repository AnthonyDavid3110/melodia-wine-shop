import type { PublicCampaign } from "@/domain/catalog/public-catalog";
import { Body, Display, Eyebrow } from "@/components/ui/typography";
import { extractCampaignYear } from "./extract-campaign-year";

/**
 * Campaign hero — the page's one H1 (via `Display`, Gate 2
 * accessibility requirement: exactly one meaningful H1). Uses database
 * campaign content where available; falls back to safe, already-used
 * static copy (Phase 1 exploration pages) when `description` is null.
 * Never invents a date — the campaign's own `name`/`publicTitle` may
 * already contain a year as plain text (e.g. "Les Vins de Mélodia
 * 2026"), but nothing here parses or reconstructs one beyond
 * surfacing it decoratively (see `extractCampaignYear`).
 *
 * Gate 2C rebalance: wide desktop previously left the whole right half
 * empty. Rather than fake photography, an oversized, extremely pale
 * "programme numeral" (the year already present in the campaign's own
 * text, when one is) fills that space decoratively — purely visual,
 * `aria-hidden`, desktop-only, and never competes with the H1 (kept
 * well clear of the text column, clipped by the section's own
 * `overflow-hidden`).
 */
export function Hero({ campaign }: { campaign: PublicCampaign }) {
  const title = campaign.publicTitle ?? campaign.name;
  const description =
    campaign.description ??
    "Découvrez notre sélection de vins et soutenez l'Ensemble de Cuivres Mélodia.";
  const year = extractCampaignYear(campaign.publicTitle ?? campaign.name);

  return (
    <section className="bg-sand relative overflow-hidden">
      {year ? (
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute top-1/2 -right-16 hidden -translate-y-1/2 text-[26rem] leading-none text-foreground/[0.05] select-none lg:block"
        >
          {year}
        </span>
      ) : null}
      <div className="relative mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <Eyebrow>Ensemble de Cuivres Mélodia</Eyebrow>
        <Display className="mt-3 max-w-lg">{title}</Display>
        <Body className="text-foreground/75 mt-5 max-w-md">{description}</Body>
        <div className="mt-8">
          <a
            href="#selection"
            className="bg-primary text-primary-foreground inline-flex items-center px-7 py-3.5 text-sm font-medium"
          >
            Découvrir les vins
          </a>
        </div>
      </div>
    </section>
  );
}
