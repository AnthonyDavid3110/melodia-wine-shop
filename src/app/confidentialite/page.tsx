import type { Metadata } from "next";
import {
  ClipboardList,
  Clock,
  Cookie,
  CreditCard,
  Landmark,
  Mail,
  Server,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { Body, Display, H2 } from "@/components/ui/typography";
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
 * One editorial section: a small decorative oxblood icon beside a
 * heading + body copy, never a boxed/shadowed card — the page should
 * read like content printed on the existing paper surface, not a
 * dashboard. The icon is purely decorative (`aria-hidden`); the
 * heading itself already carries the accessible section name, so nothing
 * duplicates it for screen readers.
 */
function PrivacySection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <Icon className="text-accent mt-1 size-5 shrink-0" aria-hidden="true" />
      <div>
        <H2 className="text-lg">{title}</H2>
        <div className="text-foreground/70 mt-2 flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}

/**
 * Phase 15 — TBD-SEC-006. The one combined public privacy/legal-
 * information page (business decision: one page, not three). Purely
 * static, factual content — no legal advice, no certification claim,
 * no invented statutory basis. See docs/09-SECURITY.md's `TBD-SEC-006`
 * entry for the decision record.
 *
 * Visual refinement (Phase 15, approved mockup): an editorial hero
 * plus a two-column grid on desktop (single column on mobile) —
 * content and meaning are unchanged from the original implementation,
 * only the presentation.
 */
export default async function PrivacyPage() {
  const catalog = await getPublicCatalog();
  const [careOf, street, ...rest] = ORGANISATION_IDENTITY.addressLines;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader catalog={catalog} />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <Display as="h1" className="text-accent max-w-2xl">
            Confidentialité &amp; mentions légales
          </Display>
          <Body className="text-foreground/70 mt-6 max-w-xl">
            Cette page explique comment l&rsquo;Ensemble de Cuivres Mélodia collecte et utilise les
            données personnelles dans le cadre de la vente de vins, ainsi que les informations
            légales concernant l&rsquo;association. Elle ne constitue pas un avis juridique.
          </Body>
        </div>

        <div className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
          <div className="grid gap-12 md:grid-cols-2 md:gap-x-16">
            <div className="flex flex-col gap-12">
              <PrivacySection icon={Landmark} title="Responsable du traitement">
                <Body>
                  Le traitement des données décrit ici est effectué par l&rsquo;
                  {ORGANISATION_IDENTITY.name}, organisatrice de cette vente de vins.
                </Body>
                <Body className="text-sm">
                  {careOf}
                  <br />
                  {street}
                  <br />
                  {rest.join(" · ")}
                </Body>
              </PrivacySection>

              <PrivacySection icon={ClipboardList} title="Données collectées">
                <Body>
                  Lors d&rsquo;une commande, nous recueillons : prénom, nom, adresse postale, NPA,
                  localité, e-mail, téléphone, ainsi qu&rsquo;une éventuelle remarque de livraison.
                </Body>
                <Body>
                  Si vous indiquez un membre de l&rsquo;Ensemble de Cuivres Mélodia, cette
                  information est associée à votre commande. Les informations relatives à votre
                  commande (articles, montant, statut de paiement) sont également conservées.
                </Body>
              </PrivacySection>

              <PrivacySection icon={SlidersHorizontal} title="Utilisation des données">
                <Body>
                  Ces informations sont utilisées pour traiter votre commande, organiser la
                  livraison, l&rsquo;associer le cas échéant au membre de Mélodia qui vous l&rsquo;a
                  proposée, vous envoyer une confirmation de commande, et traiter le paiement en
                  ligne lorsque ce mode de paiement est choisi.
                </Body>
              </PrivacySection>
            </div>

            <div className="flex flex-col gap-12">
              <PrivacySection icon={Server} title="Prestataires">
                <Body>
                  Ce site est hébergé par Vercel. La base de données est hébergée par Neon. La
                  confirmation de commande par e-mail est envoyée via Resend, à qui les informations
                  nécessaires à cet envoi sont transmises.
                </Body>
              </PrivacySection>

              <PrivacySection icon={CreditCard} title="Paiement en ligne">
                <Body>
                  Lorsque le paiement en ligne (TWINT / carte) est proposé, il est traité par
                  Worldline (Saferpay) sur une page sécurisée fournie par ce prestataire. Les
                  informations de paiement sont saisies directement sur cette page et ne transitent
                  pas par l&rsquo;application Melodia, qui ne les stocke pas.
                </Body>
              </PrivacySection>

              <PrivacySection icon={Clock} title="Conservation">
                <Body>
                  L&rsquo;Ensemble de Cuivres Mélodia conserve l&rsquo;historique de ses campagnes
                  et commandes, y compris les informations client associées à chaque commande, sans
                  durée de conservation automatique prédéfinie. Il n&rsquo;existe pas de suppression
                  ni d&rsquo;anonymisation automatique de ces données.
                </Body>
                <Body>
                  Cette conservation vise à préserver l&rsquo;historique des ventes de
                  l&rsquo;association. Les sauvegardes protégées de la base de données peuvent
                  également contenir ces informations.
                </Body>
              </PrivacySection>

              <PrivacySection icon={Cookie} title="Stockage local et cookies">
                <Body>
                  Le site public n&rsquo;utilise aucun cookie publicitaire ou de suivi statistique.
                  Le panier est conservé localement dans votre navigateur. Des cookies
                  d&rsquo;authentification sont utilisés uniquement pour l&rsquo;espace
                  d&rsquo;administration réservé aux membres de Mélodia.
                </Body>
              </PrivacySection>

              <PrivacySection icon={Mail} title="Contact">
                <Body>
                  Pour toute question concernant le traitement de vos données personnelles, vous
                  pouvez contacter l&rsquo;Ensemble de Cuivres Mélodia à{" "}
                  <a
                    href="mailto:communications@ecmelodia.ch"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    communications@ecmelodia.ch
                  </a>
                  .
                </Body>
              </PrivacySection>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
