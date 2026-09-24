import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignSelector } from "@/components/admin/campaign-selector";
import { resolveExportCampaign } from "./resolve-export-campaign";

interface ExportLink {
  href: string;
  label: string;
  description: string;
}

function buildExportLinks(campaignId: string): ExportLink[] {
  const suffix = `?campaign=${campaignId}`;
  return [
    {
      href: `/admin/exports/orders.csv${suffix}`,
      label: "Commandes (CSV)",
      description: "Historique complet des commandes, y compris annulées, avec le paiement.",
    },
    {
      href: `/admin/exports/order-items.csv${suffix}`,
      label: "Lignes de commande (CSV)",
      description: "Détail des vins et bundles commandés, joignable via le numéro de commande.",
    },
    {
      href: `/admin/exports/seller-sales.csv${suffix}`,
      label: "Ventes par vendeur (CSV)",
      description: "Ventes, encaissements et règlements par vendeur pour la campagne.",
    },
    {
      href: `/admin/exports/wine-requirements.csv${suffix}`,
      label: "Besoins en vin (CSV)",
      description: "Quantités exactes de bouteilles requises pour la préparation.",
    },
  ];
}

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  await requireAdmin();
  const { campaign: campaignParam } = await searchParams;

  const { campaign, relevantCampaigns } = await resolveExportCampaign(campaignParam ?? null);

  if (!campaign) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Exports"
          description="Téléchargez les données de la campagne au format CSV."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne active ou clôturée ne peut être exportée pour le moment.
        </p>
      </div>
    );
  }

  const links = buildExportLinks(campaign.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border flex flex-col gap-4 border-b pb-6">
        <PageHeader
          title="Exports"
          description="Téléchargez les données de la campagne au format CSV."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Campagne : <span className="text-foreground font-medium">{campaign.name}</span>
        </p>
        <CampaignSelector
          campaigns={relevantCampaigns.map((c) => ({ id: c.id, name: c.name }))}
          currentCampaignId={campaign.id}
          basePath="/admin/exports"
        />
      </div>

      <ul className="flex flex-col gap-4">
        {links.map((link) => (
          <li
            key={link.href}
            className="border-border flex flex-col gap-2 border-b pb-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">{link.label}</p>
              <p className="text-muted-foreground text-body-sm font-sans">{link.description}</p>
            </div>
            <a
              href={link.href}
              className="border-border hover:bg-surface-muted text-body-sm shrink-0 rounded-sm border px-4 py-2 font-sans font-medium transition-colors"
            >
              Télécharger
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
