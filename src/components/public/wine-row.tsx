import Image from "next/image";
import { formatCHF } from "@/domain/money";
import type { PublicWine } from "@/domain/catalog/public-catalog";
import { Body, H3, Metadata } from "@/components/ui/typography";
import { PlaceholderBottle } from "./placeholder-bottle";
import { formatMetadataLine } from "./format-metadata-line";
import { wineCategoryLabel } from "./wine-category-label";

/**
 * One alternating editorial wine entry — the productionized Phase 1
 * `PublicComposition` pattern (src/app/design-system), reading only
 * from `PublicWine` props, never from design-system demo data. Works
 * identically for any wine count: the parent just `.map()`s over
 * `PublicCatalog.wines` and passes `index`.
 *
 * Gate 2C content hierarchy: `shortDescription ?? description` is the
 * primary editorial line; `tastingNotes` only adds a second line when
 * present AND textually distinct from the primary one (never repeats
 * it); `grapeVariety` joins the restrained producer/region/vintage
 * metadata line rather than getting its own row. None of the current
 * seed data populates any of these fields — they render exactly as
 * absent right now, which is correct (never fabricated).
 */
export function WineRow({ wine, index }: { wine: PublicWine; index: number }) {
  const number = String(index + 1).padStart(2, "0");
  const imageFirst = index % 2 === 0;
  const details = formatMetadataLine([wine.producer, wine.region, wine.vintage, wine.grapeVariety]);
  const primaryText = wine.shortDescription ?? wine.description;
  const tastingText =
    wine.tastingNotes && wine.tastingNotes !== primaryText ? wine.tastingNotes : null;

  return (
    <div className="border-border relative grid items-center gap-6 border-t py-12 first:border-t-0 first:pt-0 md:grid-cols-2 md:gap-14">
      {/* Decorative oversized numeral — desktop only, purely visual, never read by assistive tech. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 -left-2 hidden font-display text-[9rem] leading-none text-foreground/[0.06] select-none md:block lg:text-[11rem]"
      >
        {number}
      </span>

      <div className={imageFirst ? "relative order-1" : "relative order-1 md:order-2"}>
        <div className="bg-sand relative flex h-56 items-center justify-center sm:h-64">
          {wine.imageUrl ? (
            <Image
              src={wine.imageUrl}
              alt={wine.name}
              fill
              sizes="(min-width: 768px) 40vw, 80vw"
              className="object-contain p-6"
            />
          ) : (
            <PlaceholderBottle
              label={wine.name}
              className="text-foreground h-[13.5rem] w-20 sm:h-[15.5rem] sm:w-[5.75rem]"
            />
          )}
        </div>
      </div>

      <div className={imageFirst ? "relative order-2" : "relative order-2 md:order-1"}>
        <Metadata as="p">
          N°{number} · {wineCategoryLabel(wine.category)}
        </Metadata>
        <H3 className="mt-1 text-2xl">{wine.name}</H3>
        {details ? (
          <Metadata as="p" className="mt-1 uppercase">
            {details}
          </Metadata>
        ) : null}
        {primaryText ? (
          <Body className="text-foreground/70 mt-3 max-w-sm text-sm">{primaryText}</Body>
        ) : null}
        {tastingText ? (
          <Body className="text-foreground/60 mt-2 max-w-sm text-sm italic">{tastingText}</Body>
        ) : null}
        <p className="mt-4 font-sans text-xl font-semibold tabular-nums">{formatCHF(wine.price)}</p>
      </div>
    </div>
  );
}
