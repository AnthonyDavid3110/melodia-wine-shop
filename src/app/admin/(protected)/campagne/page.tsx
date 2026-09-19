import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { listCampaigns } from "@/infrastructure/campaign/campaigns";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";

const statusLabel: Record<CampaignStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  CLOSED: "Clôturée",
  ARCHIVED: "Archivée",
};

const statusTone: Record<CampaignStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

export default async function CampaignsPage() {
  await requireAdmin();
  const campaigns = await listCampaigns();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Campagnes"
        description="Gérez les différentes éditions de la vente des Vins de Mélodia. Les campagnes clôturées et archivées restent consultables."
        action={
          <Button asChild>
            <Link href="/admin/campagne/nouveau">Nouvelle campagne</Link>
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne pour le moment.
        </p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Créée le</th>
                <th className="px-4 py-3 font-medium" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/campagne/${campaign.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone[campaign.status as CampaignStatus]}>
                      {statusLabel[campaign.status as CampaignStatus]}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {new Intl.DateTimeFormat("fr-CH").format(campaign.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/campagne/${campaign.id}`}
                      className="text-accent text-body-sm font-sans underline-offset-2 hover:underline"
                    >
                      Configurer →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
