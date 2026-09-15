import { Eyebrow, Display, Body } from "@/components/ui/typography";
import { Section } from "./_components/section";
import { ColorTokens } from "./_components/color-tokens";
import { TypeScale } from "./_components/type-scale";
import { ButtonsAndBadges } from "./_components/buttons-and-badges";
import { FormControls } from "./_components/form-controls";
import { PublicComposition } from "./_components/public-composition";
import { Cart } from "./_components/cart";
import { AdminOrders } from "./_components/admin-orders";
import { OverlaysDemo } from "./_components/overlays-demo";

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="max-w-2xl">
        <Eyebrow>Phase 1 · Foundation</Eyebrow>
        <Display as="h1" className="mt-3 text-4xl sm:text-5xl">
          Design system
        </Display>
        <Body className="text-muted-foreground mt-4">
          Foundation réelle (tokens, typographie, primitives) construite à partir de la direction
          approuvée Programme V2. Cette page compare l&apos;usage public (émotion, éditorial) et
          l&apos;usage admin (clarté, densité) sur la même base. Données statiques de démonstration
          uniquement — aucune logique métier.
        </Body>
      </div>

      <div className="mt-12 flex flex-col">
        <Section
          eyebrow="Fondation"
          title="Couleurs"
          description="Palette Programme V2 et couleurs sémantiques fonctionnelles."
        >
          <ColorTokens />
        </Section>

        <Section
          eyebrow="Fondation"
          title="Typographie"
          description="Fraunces (display) + IBM Plex Sans (interface)."
        >
          <TypeScale />
        </Section>

        <Section eyebrow="Primitives" title="Boutons, badges et statuts">
          <ButtonsAndBadges />
        </Section>

        <Section
          eyebrow="Primitives"
          title="Champs de formulaire"
          description="Y compris le combobox de sélection de membre (~70 entrées)."
        >
          <FormControls />
        </Section>

        <Section eyebrow="Primitives" title="Fenêtres modales et panneaux">
          <OverlaysDemo />
        </Section>

        <Section
          eyebrow="Composition publique"
          title="Campagne — hero et sélection"
          description="Ton éditorial, chaleureux — priorité à l'émotion et au produit."
        >
          <PublicComposition />
        </Section>

        <Section eyebrow="Composition publique" title="Panier">
          <Cart />
        </Section>

        <Section
          eyebrow="Composition admin"
          title="Liste des commandes"
          description="Même fondation, densité et priorités différentes — clarté et rapidité de lecture."
        >
          <AdminOrders />
        </Section>
      </div>
    </main>
  );
}
