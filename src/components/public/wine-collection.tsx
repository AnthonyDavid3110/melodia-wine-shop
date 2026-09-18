import type { PublicWine } from "@/domain/catalog/public-catalog";
import { Eyebrow, H2 } from "@/components/ui/typography";
import { WineRow } from "./wine-row";

/**
 * Maps over `PublicCatalog.wines` — works identically for any count
 * (3, 6, 10, ...), never assumes a fixed wine list.
 */
export function WineCollection({ wines }: { wines: PublicWine[] }) {
  return (
    // Gate 2C: asymmetric top/bottom padding — generous above (this is
    // the first content section after the hero) but tighter below, so
    // the last wine leads deliberately into the Discovery Box rather
    // than leaving a large dead gap before it.
    <section id="selection" className="mx-auto max-w-5xl px-5 pt-14 pb-6 sm:px-8 sm:pt-20">
      <div className="flex items-baseline justify-between">
        <H2>La sélection</H2>
        <Eyebrow className="text-muted-foreground">
          {wines.length} {wines.length > 1 ? "vins" : "vin"}
        </Eyebrow>
      </div>
      <div className="mt-6">
        {wines.map((wine, index) => (
          <WineRow key={wine.id} wine={wine} index={index} />
        ))}
      </div>
    </section>
  );
}
