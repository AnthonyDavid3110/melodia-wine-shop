import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  checkCampaignReadiness,
  type ReadinessSeverity,
} from "@/domain/campaign/campaign-readiness";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";
import { getCampaign } from "@/infrastructure/campaign/campaigns";
import { getCampaignReadinessFacts } from "@/infrastructure/campaign/campaign-readiness";
import { CampaignForm } from "../campaign-form";
import { formatDateInputFr } from "../date-input";
import { updateCampaignFieldsAction } from "../actions";
import { CampaignLifecycleActions } from "./lifecycle-actions";
import { CampaignProductsSection } from "./campaign-products-section";
import { BundlesSection } from "./bundles-section";
import { CampaignSellersSection } from "./campaign-sellers-section";

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

const severityTone: Record<ReadinessSeverity, StatusTone> = {
  blocking: "danger",
  warning: "warning",
  informational: "neutral",
};

const severityLabel: Record<ReadinessSeverity, string> = {
  blocking: "Bloquant",
  warning: "Avertissement",
  informational: "Information",
};

const sections = [
  { href: "#preparation", label: "Préparation" },
  { href: "#general", label: "Général" },
  { href: "#vins", label: "Vins" },
  { href: "#carton", label: "Carton découverte" },
  { href: "#vendeurs", label: "Vendeurs" },
  { href: "#cycle-de-vie", label: "Cycle de vie" },
];

/** Minor units to a plain decimal input value — e.g. 1800 -> "18.00" — the inverse of `parseCHF`. */
function minorUnitsToInputValue(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) {
    notFound();
  }

  const status = campaign.status as CampaignStatus;
  const facts = await getCampaignReadinessFacts(campaign);
  const findings = checkCampaignReadiness(facts);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="border-border flex flex-col gap-4 border-b pb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-h2">{campaign.name}</h1>
          <StatusBadge tone={statusTone[status]}>{statusLabel[status]}</StatusBadge>
        </div>
        {campaign.publicTitle ? (
          <p className="text-muted-foreground text-body-sm font-sans">{campaign.publicTitle}</p>
        ) : null}
        {status === "ACTIVE" ? (
          <p className="border-warning text-muted-foreground text-body-sm border-l-2 pl-3 font-sans">
            Cette campagne est actuellement publiée. Les modifications enregistrées sont visibles
            immédiatement.
          </p>
        ) : null}
        <nav aria-label="Sections de la campagne" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {sections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-muted-foreground hover:bg-surface-muted hover:text-foreground text-body-sm shrink-0 rounded-sm px-3 py-1.5 font-sans transition-colors"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <section id="preparation" className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Préparation de la campagne</h2>
        {findings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {findings.map((finding, index) => (
              <li key={index} className="text-body-sm flex items-start gap-2 font-sans">
                <StatusBadge tone={severityTone[finding.severity]}>
                  {severityLabel[finding.severity]}
                </StatusBadge>
                <span className="text-muted-foreground">{finding.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucun point d&rsquo;attention détecté.
          </p>
        )}
      </section>

      <section id="general" className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Informations générales</h2>
        <CampaignForm
          action={updateCampaignFieldsAction.bind(null, campaign.id)}
          defaultValues={{
            name: campaign.name,
            publicTitle: campaign.publicTitle,
            description: campaign.description,
            openingDate: formatDateInputFr(campaign.openingDate),
            closingDate: formatDateInputFr(campaign.closingDate),
            defaultSellerTargetAmount:
              campaign.defaultSellerTargetAmount != null
                ? minorUnitsToInputValue(campaign.defaultSellerTargetAmount)
                : "",
          }}
          submitLabel="Enregistrer les modifications"
        />
      </section>

      <section id="vins" className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Vins pour cette campagne</h2>
        <CampaignProductsSection campaignId={campaign.id} />
      </section>

      <section id="carton" className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Carton découverte</h2>
        <BundlesSection campaignId={campaign.id} />
      </section>

      <section id="vendeurs" className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Vendeurs</h2>
        <CampaignSellersSection campaignId={campaign.id} />
      </section>

      <section id="cycle-de-vie" className="border-border mt-4 flex flex-col gap-3 border-t-2 pt-8">
        <h2 className="font-display text-h3">Cycle de vie</h2>
        <p className="text-muted-foreground text-body-sm font-sans">
          Ces actions changent le statut de la campagne et sont tracées.
        </p>
        <CampaignLifecycleActions campaignId={campaign.id} status={status} />
      </section>
    </div>
  );
}
