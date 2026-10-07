import type { Metadata } from "next";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { Body, BodySmall, H1, H2 } from "@/components/ui/typography";
import { ORGANISATION_IDENTITY } from "@/domain/documents/organisation-identity";

export const metadata: Metadata = {
  title: "Confidentialité & mentions légales",
  description:
    "Informations sur la collecte et l'utilisation des données personnelles par l'Ensemble de Cuivres Mélodia dans le cadre de la vente de vins.",
};

/**
 * Same reasoning as `/`, `/panier`, `/commande` (Phase 4/6/7): fetches
 * through a raw `pg` connection, not `fetch()`, so Next needs the
 * explicit signal to render fresh rather than freeze a build-time
 * snapshot — here only the header/cart-badge data is live, the legal
 * content itself is entirely static.
 */
export const dynamic = "force-dynamic";

/**
 * Phase 15 — TBD-SEC-006. The one combined public privacy/legal-
 * information page (business decision: one page, not three). Purely
 * static, factual content — no legal advice, no certification claim,
 * no invented statutory basis. See docs/09-SECURITY.md's `TBD-SEC-006`
 * entry for the decision record.
 */
export default async function PrivacyPage() {
  const catalog = await getPublicCatalog();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader catalog={catalog} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:px-8">
        <H1 className="text-2xl">Confidentialité &amp; mentions légales</H1>
        <Body className="text-foreground/70 mt-4">
          Cette page explique, de manière simple et factuelle, quelles informations sont collectées
          lors d&rsquo;une commande sur ce site, pourquoi, et comment elles sont utilisées. Elle ne
          constitue pas un avis juridique.
        </Body>

        <section aria-labelledby="confidentialite-responsable" className="mt-10">
          <H2 id="confidentialite-responsable" className="text-lg">
            Responsable
          </H2>
          <Body className="text-foreground/70 mt-2">
            Le traitement des données décrit ici est effectué par l&rsquo;
            {ORGANISATION_IDENTITY.name}, organisatrice de cette vente de vins.
          </Body>
          <BodySmall className="text-foreground/60 mt-2">
            {ORGANISATION_IDENTITY.addressLines.join(", ")}
          </BodySmall>
        </section>

        <section aria-labelledby="confidentialite-donnees" className="mt-10">
          <H2 id="confidentialite-donnees" className="text-lg">
            Données collectées
          </H2>
          <Body className="text-foreground/70 mt-2">
            Lors d&rsquo;une commande, nous recueillons : prénom, nom, adresse postale, NPA,
            localité, e-mail, téléphone, ainsi qu&rsquo;une éventuelle remarque de livraison. Si
            vous indiquez un membre de l&rsquo;Ensemble de Cuivres Mélodia, cette information est
            associée à votre commande. Les informations relatives à votre commande (articles,
            montant, statut de paiement) sont également conservées.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-utilisation" className="mt-10">
          <H2 id="confidentialite-utilisation" className="text-lg">
            Utilisation des données
          </H2>
          <Body className="text-foreground/70 mt-2">
            Ces informations sont utilisées pour traiter votre commande, organiser la livraison,
            l&rsquo;associer le cas échéant au membre de Mélodia qui vous l&rsquo;a proposée, vous
            envoyer une confirmation de commande, et traiter le paiement en ligne lorsque ce mode de
            paiement est choisi.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-prestataires" className="mt-10">
          <H2 id="confidentialite-prestataires" className="text-lg">
            Prestataires
          </H2>
          <Body className="text-foreground/70 mt-2">
            Ce site est hébergé par Vercel. La base de données est hébergée par Neon. La
            confirmation de commande par e-mail est envoyée via Resend, à qui les informations
            nécessaires à cet envoi sont transmises.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-paiement" className="mt-10">
          <H2 id="confidentialite-paiement" className="text-lg">
            Paiement en ligne
          </H2>
          <Body className="text-foreground/70 mt-2">
            Lorsque le paiement en ligne (TWINT / carte) est proposé, il est traité par Worldline
            (Saferpay) sur une page sécurisée fournie par ce prestataire. Les informations de
            paiement sont saisies directement sur cette page et ne transitent pas par
            l&rsquo;application Melodia, qui ne les stocke pas.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-conservation" className="mt-10">
          <H2 id="confidentialite-conservation" className="text-lg">
            Conservation
          </H2>
          <Body className="text-foreground/70 mt-2">
            L&rsquo;Ensemble de Cuivres Mélodia conserve l&rsquo;historique de ses campagnes et
            commandes, y compris les informations client associées à chaque commande, sans durée de
            conservation automatique prédéfinie. Il n&rsquo;existe pas de suppression ni
            d&rsquo;anonymisation automatique de ces données. Cette conservation vise à préserver
            l&rsquo;historique des ventes de l&rsquo;association. Les sauvegardes protégées de la
            base de données peuvent également contenir ces informations.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-cookies" className="mt-10">
          <H2 id="confidentialite-cookies" className="text-lg">
            Stockage local et cookies
          </H2>
          <Body className="text-foreground/70 mt-2">
            Le site public n&rsquo;utilise aucun cookie publicitaire ou de suivi statistique. Le
            panier est conservé localement dans votre navigateur. Des cookies
            d&rsquo;authentification sont utilisés uniquement pour l&rsquo;espace
            d&rsquo;administration réservé aux membres de Mélodia.
          </Body>
        </section>

        <section aria-labelledby="confidentialite-contact" className="mt-10">
          <H2 id="confidentialite-contact" className="text-lg">
            Contact
          </H2>
          <Body className="text-foreground/70 mt-2">
            Pour toute question concernant le traitement de vos données personnelles, vous pouvez
            contacter l&rsquo;Ensemble de Cuivres Mélodia à{" "}
            <a
              href="mailto:communications@ecmelodia.ch"
              className="underline-offset-2 hover:underline"
            >
              communications@ecmelodia.ch
            </a>
            .
          </Body>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
