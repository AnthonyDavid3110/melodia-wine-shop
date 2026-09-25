import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { listProducts } from "@/infrastructure/products/products";
import { listSellers } from "@/infrastructure/sellers/sellers";
import { resolveRequestedCampaign } from "@/infrastructure/campaign/resolve-requested-campaign";
import { getCampaignDashboardOrders } from "@/infrastructure/dashboard/dashboard";
import { getCampaignWineRequirements } from "@/infrastructure/fulfilment/fulfilment";
import { listCampaignSellerSalesSummaries } from "@/infrastructure/settlements/settlements";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { buildPrimaryKpis } from "@/domain/dashboard/build-primary-kpis";
import { buildPaymentKpis, type DashboardOrderInput } from "@/domain/dashboard/build-payment-kpis";
import { buildOperationalKpis } from "@/domain/dashboard/build-operational-kpis";
import { buildDashboardAlerts } from "@/domain/dashboard/build-dashboard-alerts";
import { buildSellerObjectiveSummary } from "@/domain/dashboard/build-seller-objective-summary";
import { formatCHF, type Money } from "@/domain/money";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import {
  customerPaymentStatusLabel,
  orderStatusLabel,
  paymentMethodLabel,
} from "@/domain/orders/order-labels";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignSelector } from "@/components/admin/campaign-selector";
import { StatGrid } from "@/components/admin/stat-grid";

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

const RECENT_ORDERS_LIMIT = 10;

/**
 * Operational dashboard (Phase 13 Gate 13B, docs/06-ADMIN-SPEC.md
 * §4-§7) — answers "what is happening now, and what needs attention?"
 * for the selected campaign. `/admin/statistiques` ("how is/was the
 * campaign performing?", §50) is Gate 13C, not implemented here.
 * `requireAdmin()` remains this page's own independent authorization
 * boundary (Phase 3 Gate 1), unchanged even though the shared layout
 * also calls it for display purposes.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  await requireAdmin();
  const { campaign: campaignParam } = await searchParams;

  const [{ campaign, relevantCampaigns }, products, sellers] = await Promise.all([
    resolveRequestedCampaign(campaignParam ?? null),
    listProducts(),
    listSellers(),
  ]);

  const counts: Record<string, string> = {
    "/admin/produits": `${products.length} produit${products.length === 1 ? "" : "s"}`,
    "/admin/vendeurs": `${sellers.length} vendeur${sellers.length === 1 ? "" : "s"}`,
  };

  const navGrid = (
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
          <span className="text-muted-foreground text-body-sm font-sans">{block.description}</span>
          {counts[block.href] ? (
            <span className="text-muted-foreground text-caption mt-2 font-sans tracking-widest uppercase">
              {counts[block.href]}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  if (!campaign) {
    return (
      <div className="flex flex-col gap-10">
        <PageHeader
          eyebrow="Les vins de Mélodia"
          title="Administration"
          description="Configurez la campagne, la bibliothèque de vins et les vendeurs de l'Ensemble de Cuivres Mélodia."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne active ou clôturée : le tableau de bord opérationnel n&rsquo;a rien à
          afficher pour le moment.
        </p>
        {navGrid}
      </div>
    );
  }

  const [dashboardOrders, wineRequirements, sellerSummaries] = await Promise.all([
    getCampaignDashboardOrders(campaign.id),
    getCampaignWineRequirements(campaign.id),
    listCampaignSellerSalesSummaries(campaign.id),
  ]);

  const bottleCount = wineRequirements.reduce((sum, requirement) => sum + requirement.bottles, 0);

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

  const primaryKpis = buildPrimaryKpis(kpiOrders, bottleCount);
  const paymentKpis = buildPaymentKpis(kpiOrders);
  const operationalKpis = buildOperationalKpis(kpiOrders);
  const alerts = buildDashboardAlerts(kpiOrders, paymentKpis.outstandingSellerSettlements);
  const sellerObjectives = buildSellerObjectiveSummary(sellerSummaries);

  const recentOrders = dashboardOrders.slice(0, RECENT_ORDERS_LIMIT).map((row) => {
    const authoritativePayment = selectAuthoritativePaymentForExport(row.payments);
    return {
      id: row.order.id,
      orderNumber: row.order.orderNumber,
      customerName: `${row.order.customerFirstName} ${row.order.customerLastName}`,
      totalAmount: row.order.totalAmount as Money,
      sellerName: row.seller ? formatSellerName(row.seller) : null,
      status: row.order.status,
      customerPaymentStatus: row.order.customerPaymentStatus,
      paymentMethod: authoritativePayment?.method ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="border-border flex flex-col gap-4 border-b pb-6">
        <PageHeader
          eyebrow="Les vins de Mélodia"
          title="Administration"
          description="État opérationnel de la campagne : ce qui se passe maintenant, et ce qui nécessite une action."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Campagne : <span className="text-foreground font-medium">{campaign.name}</span>{" "}
          <StatusBadge tone={campaign.status === "ACTIVE" ? "success" : "neutral"}>
            {campaign.status === "ACTIVE" ? "Active" : "Clôturée"}
          </StatusBadge>
        </p>
        <CampaignSelector
          campaigns={relevantCampaigns.map((c) => ({ id: c.id, name: c.name }))}
          currentCampaignId={campaign.id}
          basePath="/admin"
        />
      </div>

      {alerts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={alert.href}
                className="border-warning bg-warning/10 hover:bg-warning/15 text-body-sm flex items-center gap-3 border-l-2 px-4 py-3 font-sans transition-colors"
              >
                <span className="bg-warning size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                {alert.message}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Ventes
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
          stats={[
            { label: "Payé en ligne", value: formatCHF(paymentKpis.onlinePaid) },
            { label: "Paiement au vendeur", value: formatCHF(paymentKpis.sellerPayment) },
            {
              label: "Encaissements clients en attente",
              value: formatCHF(paymentKpis.outstandingCustomerPayments),
            },
            {
              label: "Règlements vendeurs en attente",
              value: formatCHF(paymentKpis.outstandingSellerSettlements),
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Opérationnel
        </p>
        <StatGrid
          stats={[
            { label: "Non attribuées", value: String(operationalKpis.unassignedOrders) },
            { label: "À préparer", value: String(operationalKpis.toPrepare) },
            { label: "Préparées", value: String(operationalKpis.prepared) },
            { label: "Livrées", value: String(operationalKpis.delivered) },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Objectifs vendeurs
        </p>
        {sellerObjectives.totalWithTargetCount === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucun objectif défini pour cette campagne.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-sans text-sm">
              <span className="font-medium">{sellerObjectives.reachedCount}</span> /{" "}
              {sellerObjectives.totalWithTargetCount} objectifs atteints
            </p>
            {sellerObjectives.reachedCount > 0 ? (
              <p className="text-muted-foreground text-body-sm font-sans">
                {sellerObjectives.reachedSellers
                  .map((seller) => `${seller.sellerName} (${seller.percentage}%)`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Commandes récentes
        </p>
        {recentOrders.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune commande pour cette campagne.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Commande</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Vendeur</th>
                  <th className="px-4 py-3 font-medium">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/commandes/${order.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{order.customerName}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatCHF(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {order.sellerName ?? (
                        <span className="text-muted-foreground italic">Non attribuée</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {order.paymentMethod ? paymentMethodLabel(order.paymentMethod) : "—"} ·{" "}
                      {order.status === "CANCELLED"
                        ? orderStatusLabel(order.status)
                        : customerPaymentStatusLabel(order.customerPaymentStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
          Sections
        </p>
        {navGrid}
        <Button asChild variant="outline" className="self-start">
          <Link href={`/admin/campagne/${campaign.id}`}>Configurer la vente</Link>
        </Button>
      </div>
    </div>
  );
}
