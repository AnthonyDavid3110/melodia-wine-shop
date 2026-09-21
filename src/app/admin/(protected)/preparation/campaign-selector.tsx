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
 * campaign is always named explicitly nearby regardless.
 */
export function CampaignSelector({
  campaigns,
  currentCampaignId,
}: {
  campaigns: SelectableCampaign[];
  currentCampaignId: string;
}) {
  if (campaigns.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sélection de la campagne" className="-mx-1 flex flex-wrap gap-1">
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          href={`/admin/preparation?campaign=${campaign.id}`}
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
