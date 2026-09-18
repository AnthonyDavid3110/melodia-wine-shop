import { Body } from "@/components/ui/typography";

/**
 * Distinct from "no active campaign": the campaign IS open, just
 * nothing is configured in the catalog yet (Gate 2 §8). Renders in
 * place of the wine grid — never an empty grid structure.
 */
export function EmptySelectionNotice() {
  return (
    <section id="selection" className="mx-auto max-w-md px-5 py-14 text-center sm:px-8">
      <Body className="text-foreground/75">
        La sélection de cette édition sera annoncée prochainement.
      </Body>
    </section>
  );
}
