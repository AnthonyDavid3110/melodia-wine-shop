import type { PublicWine } from "@/domain/catalog/public-catalog";
import { Body, Eyebrow, H2 } from "@/components/ui/typography";
import { WineRow } from "./wine-row";
import { WINE_LOT_SIZE } from "@/domain/cart/cart";

/**
 * Maps over `PublicCatalog.wines` — works identically for any count
 * (3, 6, 10, ...), never assumes a fixed wine list.
 */
export function WineCollection({ wines }: { wines: PublicWine[] }) {
  return (
    // Gate 2C: asymmetric top/bottom padding, generous above — CORR-003
    // moved the Discovery Box before this section (it's no longer the
    // first content block after the hero), but the same breathing room
    // still reads well following that section's own full-width band.
    <section id="selection" className="mx-auto max-w-5xl px-5 pt-14 pb-6 sm:px-8 sm:pt-20">
      <div className="flex items-baseline justify-between">
        <H2>Les vins, par lots de {WINE_LOT_SIZE}</H2>
        <Eyebrow className="text-muted-foreground">
          {wines.length} {wines.length > 1 ? "vins" : "vin"}
        </Eyebrow>
      </div>
      <Body className="text-foreground/70 mt-2 max-w-md text-sm">
        Chaque vin se commande par lot de {WINE_LOT_SIZE} bouteilles identiques — idéal pour
        composer votre propre sélection en complément du carton découverte.
      </Body>
      <div className="mt-6">
        {wines.map((wine, index) => (
          <WineRow key={wine.id} wine={wine} index={index} />
        ))}
      </div>
    </section>
  );
}
