import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { listCampaigns } from "@/infrastructure/campaign/campaigns";
import { listProducts } from "@/infrastructure/products/products";
import { listSellers } from "@/infrastructure/sellers/sellers";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = {
  title: "Administration — Mélodia",
  robots: { index: false, follow: false },
};

const navBlocks = [
  {
    href: "/admin/campagne",
    title: "Campagne",
    description: "Configurer la vente en cours",
  },
  {
    href: "/admin/produits",
    title: "Produits",
    description: "Gérer la bibliothèque des vins",
  },
  {
    href: "/admin/vendeurs",
    title: "Vendeurs",
    description: "Gérer les membres participant aux ventes",
  },
];

/**
 * Operational admin entry point (Phase 5 Gate 2C §3) — replaces the
 * Phase 3 "Espace protégé" placeholder, which was only ever meant to
 * prove the authentication boundary worked, not to be the long-term
 * homepage. Deliberately not a KPI dashboard (that's Phase 13):
 * editorial navigation blocks with light factual context, not
 * analytics cards. `requireAdmin()` remains this page's own
 * independent authorization boundary (Phase 3 Gate 1), unchanged even
 * though the shared layout also calls it for display purposes.
 */
export default async function AdminHomePage() {
  await requireAdmin();
  const [campaigns, products, sellers] = await Promise.all([
    listCampaigns(),
    listProducts(),
    listSellers(),
  ]);
  const active = campaigns.find((campaign) => campaign.status === "ACTIVE");

  const counts: Record<string, string> = {
    "/admin/produits": `${products.length} produit${products.length === 1 ? "" : "s"}`,
    "/admin/vendeurs": `${sellers.length} vendeur${sellers.length === 1 ? "" : "s"}`,
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Les vins de Mélodia"
        title="Administration"
        description="Configurez la campagne, la bibliothèque de vins et les vendeurs de l'Ensemble de Cuivres Mélodia."
      />

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Campagne en cours
        </p>
        {active ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-h3">{active.name}</h2>
              <StatusBadge tone="success">Active</StatusBadge>
            </div>
            <Button asChild>
              <Link href={`/admin/campagne/${active.id}`}>Configurer la vente</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-body-sm font-sans">Aucune campagne active.</p>
            <Button asChild variant="outline">
              <Link href="/admin/campagne">Voir les campagnes</Link>
            </Button>
          </div>
        )}
      </div>

      <nav
        aria-label="Sections d'administration"
        className="border-border bg-border grid gap-px border sm:grid-cols-3"
      >
        {navBlocks.map((block) => (
          <Link
            key={block.href}
            href={block.href}
            className="bg-surface hover:bg-surface-muted flex flex-col gap-1.5 p-6 transition-colors"
          >
            <span className="font-display text-h3">{block.title}</span>
            <span className="text-muted-foreground text-body-sm font-sans">
              {block.description}
            </span>
            {counts[block.href] ? (
              <span className="text-muted-foreground text-caption mt-2 font-sans tracking-widest uppercase">
                {counts[block.href]}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
