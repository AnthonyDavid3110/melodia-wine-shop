import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SelectableCampaign {
  id: string;
  name: string;
}

/**
 * Restrained campaign context selector (Phase 9 §8/§22) — plain links
 * carrying `?campaign=<id>`, server-rendered, no client JS. Only shown
 * at all when more than one ACTIVE/CLOSED campaign exists; the current
 * campaign is always named explicitly nearby regardless. `basePath`
 * defaults to `/admin/preparation` (its original, only caller before
 * Phase 12 Gate 12A) so existing behaviour is unchanged; `/admin/exports`
 * reuses this exact component rather than a second campaign-selection
 * mechanism.
 */
export function CampaignSelector({
  campaigns,
  currentCampaignId,
  basePath = "/admin/preparation",
}: {
  campaigns: SelectableCampaign[];
  currentCampaignId: string;
  basePath?: string;
}) {
  if (campaigns.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sélection de la campagne" className="-mx-1 flex flex-wrap gap-1">
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          href={`${basePath}?campaign=${campaign.id}`}
          className={cn(
            "text-body-sm shrink-0 rounded-sm px-3 py-1.5 font-sans transition-colors",
            campaign.id === currentCampaignId
              ? "bg-surface-muted text-foreground font-medium"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          )}
        >
          {campaign.name}
        </Link>
      ))}
    </nav>
  );
}
