import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { resolveRequestedStatisticsCampaign } from "@/infrastructure/campaign/resolve-requested-statistics-campaign";
import { getCampaignDashboardOrders } from "@/infrastructure/dashboard/dashboard";
import { getCampaignWineRequirements } from "@/infrastructure/fulfilment/fulfilment";
import { getCampaignItemSalesBreakdown } from "@/infrastructure/statistics/statistics";
import { listCampaignSellerSalesSummaries } from "@/infrastructure/settlements/settlements";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { buildPrimaryKpis } from "@/domain/dashboard/build-primary-kpis";
import { buildPaymentKpis, type DashboardOrderInput } from "@/domain/dashboard/build-payment-kpis";
import { buildTwintVsCardBreakdown } from "@/domain/statistics/build-twint-vs-card-breakdown";
import { buildWineSalesTable } from "@/domain/statistics/build-wine-sales-table";
import { buildBundleSalesTable } from "@/domain/statistics/build-bundle-sales-table";
import { formatCHF, type Money } from "@/domain/money";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignSelector } from "@/components/admin/campaign-selector";
import { StatGrid } from "@/components/admin/stat-grid";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

export const metadata: Metadata = {
  title: "Statistiques — Mélodia",
  robots: { index: false, follow: false },
};

const campaignStatusLabel: Record<CampaignStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  CLOSED: "Clôturée",
  ARCHIVED: "Archivée",
};

const campaignStatusTone: Record<CampaignStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

/**
 * Analytical/historical statistics (Phase 13 Gate 13C,
 * docs/06-ADMIN-SPEC.md §50) — "how is/was the campaign performing?",
 * distinct from `/admin`'s operational "what needs attention now?"
 * (Phase 13 Gate 13B). Deliberately shows no individual order/customer
 * rows (docs/09-SECURITY.md §37: aggregated data where possible) and no
 * operational alerts/fulfilment actions — those stay on `/admin`.
 * Campaign selection covers ACTIVE/CLOSED/ARCHIVED (not just
 * ACTIVE/CLOSED) via `resolveRequestedStatisticsCampaign()`, since
 * BR-CAM-003 requires statistics to remain available after archiving.
 */
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  await requireAdmin();
  const { campaign: campaignParam } = await searchParams;
  const { campaign, relevantCampaigns } = await resolveRequestedStatisticsCampaign(
    campaignParam ?? null,
  );

  if (!campaign) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Les vins de Mélodia"
          title="Statistiques"
          description="Analyse des ventes et des performances de la campagne."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne ne dispose de données statistiques pour le moment.
        </p>
      </div>
    );
  }

  const [dashboardOrders, wineRequirements, items, sellerSummaries] = await Promise.all([
    getCampaignDashboardOrders(campaign.id),
    getCampaignWineRequirements(campaign.id),
    getCampaignItemSalesBreakdown(campaign.id),
    listCampaignSellerSalesSummaries(campaign.id),
  ]);

  const kpiOrders: DashboardOrderInput[] = dashboardOrders.map((row) => {
    const authoritativePayment = selectAuthoritativePaymentForExport(row.payments);
    return {
      status: row.order.status,
      totalAmount: row.order.totalAmount as Money,
      customerPaymentStatus: row.order.customerPaymentStatus,
      sellerSettlementStatus: row.order.sellerSettlementStatus,
      sellerId: row.order.sellerId,
      paymentMethod: authoritativePayment?.method ?? null,
    };
  });

  const bottleCount = wineRequirements.reduce((sum, requirement) => sum + requirement.bottles, 0);
  const primaryKpis = buildPrimaryKpis(kpiOrders, bottleCount);
  const paymentKpis = buildPaymentKpis(kpiOrders);
  const twintVsCard = buildTwintVsCardBreakdown(kpiOrders);
  const itemsWithMoney = items.map((item) => ({
    ...item,
    lineTotalAmount: item.lineTotalAmount as Money,
  }));
  const wineSales = buildWineSalesTable(wineRequirements, itemsWithMoney);
  const bundleSales = buildBundleSalesTable(itemsWithMoney);

  return (
    <div className="flex flex-col gap-10">
      <div className="border-border flex flex-col gap-4 border-b pb-6">
        <PageHeader
          eyebrow="Les vins de Mélodia"
          title="Statistiques"
          description="Analyse des ventes et des performances de la campagne."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Campagne : <span className="text-foreground font-medium">{campaign.name}</span>{" "}
          <StatusBadge tone={campaignStatusTone[campaign.status as CampaignStatus]}>
            {campaignStatusLabel[campaign.status as CampaignStatus]}
          </StatusBadge>
        </p>
        <CampaignSelector
          campaigns={relevantCampaigns.map((c) => ({ id: c.id, name: c.name }))}
          currentCampaignId={campaign.id}
          basePath="/admin/statistiques"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Résumé
        </p>
        <StatGrid
          stats={[
            { label: "Chiffre d'affaires", value: formatCHF(primaryKpis.revenue) },
            { label: "Commandes", value: String(primaryKpis.orderCount) },
            { label: "Bouteilles", value: String(primaryKpis.bottleCount) },
            {
              label: "Panier moyen",
              value: primaryKpis.averageOrderValue ? formatCHF(primaryKpis.averageOrderValue) : "—",
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Paiements
        </p>
        <StatGrid
          columns={2}
          stats={[
            { label: "Payé en ligne", value: formatCHF(paymentKpis.onlinePaid) },
            { label: "Paiement au vendeur", value: formatCHF(paymentKpis.sellerPayment) },
          ]}
        />
        <StatGrid
          columns={2}
          stats={[
            { label: "TWINT", value: formatCHF(twintVsCard.twint) },
            { label: "Carte", value: formatCHF(twintVsCard.card) },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Ventes par vin
        </p>
        <p className="text-muted-foreground text-body-sm font-sans">
          Les bouteilles incluent celles contenues dans les cartons ; le chiffre d&rsquo;affaires ne
          couvre que les ventes directes de bouteilles, jamais une part attribuée d&rsquo;un carton
          — ces deux colonnes ne sont pas censées se recouper.
        </p>
        {wineSales.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune vente pour cette campagne.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Vin</th>
                  <th className="px-4 py-3 font-medium">Bouteilles</th>
                  <th className="px-4 py-3 font-medium">CA ventes directes</th>
                </tr>
              </thead>
              <tbody>
                {wineSales.map((row) => (
                  <tr key={row.productId} className="border-border border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums">{row.bottles}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCHF(row.directRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Ventes par bundle
        </p>
        {bundleSales.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune vente de bundle pour cette campagne.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Bundle</th>
                  <th className="px-4 py-3 font-medium">Quantité vendue</th>
                  <th className="px-4 py-3 font-medium">Chiffre d&rsquo;affaires</th>
                </tr>
              </thead>
              <tbody>
                {bundleSales.map((row) => (
                  <tr key={row.bundleId} className="border-border border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums">{row.quantitySold}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCHF(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Ventes par vendeur
        </p>
        {sellerSummaries.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune commande pour cette campagne.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Vendeur</th>
                  <th className="px-4 py-3 font-medium">Commandes</th>
                  <th className="px-4 py-3 font-medium">Ventes</th>
                  <th className="px-4 py-3 font-medium">Payé en ligne</th>
                  <th className="px-4 py-3 font-medium">Objectif</th>
                  <th className="px-4 py-3 font-medium">Progression</th>
                </tr>
              </thead>
              <tbody>
                {sellerSummaries.map((row) => (
                  <tr
                    key={row.sellerId ?? "unassigned"}
                    className="border-border border-b last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.sellerName ?? (
                        <span className="text-muted-foreground italic">Non attribuée</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.orderCount}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCHF(row.sales)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCHF(row.onlinePaidSales)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.target !== null ? formatCHF(row.target) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.progressPercentage !== null
                        ? `${row.progressPercentage}%${row.progressPercentage >= 100 ? " · Objectif atteint" : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
