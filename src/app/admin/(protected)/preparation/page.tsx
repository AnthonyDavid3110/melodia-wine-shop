import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { orderSourceLabel, orderStatusLabel } from "@/domain/orders/order-labels";
import { calculateCartonBreakdown } from "@/domain/fulfilment/calculate-carton-breakdown";
import {
  listFulfilmentRelevantCampaigns,
  resolveDefaultFulfilmentCampaign,
} from "@/infrastructure/campaign/campaigns";
import {
  getCampaignOrderBottleCounts,
  getCampaignWineRequirements,
  listCampaignFulfilmentOrders,
  type WineRequirementRow,
} from "@/infrastructure/fulfilment/fulfilment";
import { CampaignSelector } from "./campaign-selector";
import { BulkFulfilmentForm, type BulkOrderOption } from "./bulk-fulfilment-form";
import { bulkDeliverAction, bulkHandToSellerAction, bulkPrepareAction } from "./actions";

const sections = [
  { href: "#par-vendeur", label: "Par vendeur" },
  { href: "#toutes-les-commandes", label: "Toutes les commandes" },
  { href: "#besoins-en-vin", label: "Besoins en vin" },
];

type FulfilmentRow = Awaited<ReturnType<typeof listCampaignFulfilmentOrders>>[number];

function toBulkOption(row: FulfilmentRow, bottleCounts: Map<string, number>): BulkOrderOption {
  return {
    id: row.order.id,
    orderNumber: row.order.orderNumber,
    customerName: `${row.order.customerFirstName} ${row.order.customerLastName}`,
    bottleCount: bottleCounts.get(row.order.id) ?? 0,
  };
}

export default async function PreparationPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  await requireAdmin();
  const { campaign: campaignParam } = await searchParams;

  const relevantCampaigns = await listFulfilmentRelevantCampaigns();
  const requested = campaignParam
    ? relevantCampaigns.find((candidate) => candidate.id === campaignParam)
    : undefined;
  const campaign = requested ?? (await resolveDefaultFulfilmentCampaign());

  if (!campaign) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Préparation"
          description="Organisez la préparation et la livraison physique des commandes."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne active ou clôturée ne nécessite de préparation pour le moment.
        </p>
      </div>
    );
  }

  const [fulfilmentRows, wineRequirements, bottleCounts] = await Promise.all([
    listCampaignFulfilmentOrders(campaign.id),
    getCampaignWineRequirements(campaign.id),
    getCampaignOrderBottleCounts(campaign.id),
  ]);

  const progress = { CONFIRMED: 0, PREPARED: 0, HANDED_TO_SELLER: 0, DELIVERED: 0 };
  let unassignedCount = 0;
  for (const row of fulfilmentRows) {
    if (row.order.status in progress) {
      progress[row.order.status as keyof typeof progress] += 1;
    }
    if (!row.seller) {
      unassignedCount += 1;
    }
  }

  interface SellerGroup {
    sellerId: string;
    sellerName: string;
    rows: FulfilmentRow[];
  }
  const sellerGroupsByKey = new Map<string, SellerGroup>();
  const unassignedRows: FulfilmentRow[] = [];
  for (const row of fulfilmentRows) {
    if (!row.seller) {
      unassignedRows.push(row);
      continue;
    }
    const existing = sellerGroupsByKey.get(row.seller.id);
    if (existing) {
      existing.rows.push(row);
    } else {
      sellerGroupsByKey.set(row.seller.id, {
        sellerId: row.seller.id,
        sellerName: formatSellerName(row.seller),
        rows: [row],
      });
    }
  }
  const sellerGroups = Array.from(sellerGroupsByKey.values()).sort((a, b) =>
    a.sellerName.localeCompare(b.sellerName, "fr-CH"),
  );

  const preparableOrders = fulfilmentRows
    .filter((row) => row.order.status === "CONFIRMED")
    .map((row) => toBulkOption(row, bottleCounts));

  return (
    <div className="flex flex-col gap-10">
      <div className="border-border flex flex-col gap-4 border-b pb-6">
        <PageHeader
          title="Préparation"
          description="Organisez la préparation et la livraison physique des commandes."
        />
        <p className="text-muted-foreground text-body-sm font-sans">
          Campagne : <span className="text-foreground font-medium">{campaign.name}</span>
        </p>
        <CampaignSelector
          campaigns={relevantCampaigns.map((c) => ({ id: c.id, name: c.name }))}
          currentCampaignId={campaign.id}
        />
        <nav
          aria-label="Sections de la préparation"
          className="-mx-1 flex gap-1 overflow-x-auto pb-1"
        >
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
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">Commandes</dt>
            <dd className="font-medium tabular-nums">{fulfilmentRows.length}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">À préparer</dt>
            <dd className="font-medium tabular-nums">{progress.CONFIRMED}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">Préparées</dt>
            <dd className="font-medium tabular-nums">{progress.PREPARED}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">Remises au vendeur</dt>
            <dd className="font-medium tabular-nums">{progress.HANDED_TO_SELLER}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">Livrées</dt>
            <dd className="font-medium tabular-nums">{progress.DELIVERED}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground font-sans">Non attribuées</dt>
            <dd className="text-warning font-medium tabular-nums">{unassignedCount}</dd>
          </div>
        </dl>
      </div>

      <section id="par-vendeur" className="flex flex-col gap-6">
        <h2 className="font-display text-h3">Par vendeur</h2>

        {unassignedRows.length > 0 ? (
          <div className="border-warning bg-surface-muted flex flex-col gap-3 border-l-2 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Non attribuées</p>
              <p className="text-muted-foreground text-body-sm font-sans">
                {unassignedRows.length} commande(s)
              </p>
            </div>
            <p className="text-muted-foreground text-body-sm font-sans">
              Ces commandes peuvent être préparées, mais ne peuvent pas être remises à un vendeur
              tant qu&rsquo;aucun n&rsquo;est assigné.
            </p>
            <ul className="flex flex-col gap-1.5">
              {unassignedRows.map((row) => (
                <li
                  key={row.order.id}
                  className="text-body-sm flex items-center justify-between gap-4 font-sans"
                >
                  <Link
                    href={`/admin/commandes/${row.order.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {row.order.orderNumber}
                  </Link>
                  <StatusBadge tone={row.order.status === "PREPARED" ? "success" : "neutral"}>
                    {orderStatusLabel(row.order.status)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sellerGroups.length === 0 && unassignedRows.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune commande pour cette campagne.
          </p>
        ) : null}

        {sellerGroups.map((group) => {
          const bottleTotal = group.rows.reduce(
            (sum, row) => sum + (bottleCounts.get(row.order.id) ?? 0),
            0,
          );
          const readyForHandoff = group.rows
            .filter((row) => row.order.status === "PREPARED")
            .map((row) => toBulkOption(row, bottleCounts));
          const readyForDelivery = group.rows
            .filter((row) => row.order.status === "HANDED_TO_SELLER")
            .map((row) => toBulkOption(row, bottleCounts));

          return (
            <div key={group.sellerId} className="border-border flex flex-col gap-4 border-t pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/admin/vendeurs/${group.sellerId}`}
                  className="font-display text-h4 underline-offset-2 hover:underline"
                >
                  {group.sellerName}
                </Link>
                <p className="text-muted-foreground text-body-sm font-sans">
                  {group.rows.length} commande(s) · {bottleTotal} bouteille(s)
                </p>
              </div>

              {readyForHandoff.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm font-medium">Prêtes à remettre</p>
                  <BulkFulfilmentForm
                    orders={readyForHandoff}
                    triggerLabel="Remettre au vendeur"
                    confirmTitleTemplate={`Remettre {count} commande(s) à ${group.sellerName} ?`}
                    confirmDescription="Ces commandes seront marquées comme remises au vendeur pour livraison."
                    action={bulkHandToSellerAction.bind(null, campaign.id, group.sellerId)}
                  />
                </div>
              ) : null}

              {readyForDelivery.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm font-medium">Remises, en attente de livraison</p>
                  <BulkFulfilmentForm
                    orders={readyForDelivery}
                    triggerLabel="Marquer comme livrées"
                    confirmTitleTemplate="Marquer {count} commande(s) comme livrées ?"
                    confirmDescription="Confirmez que le vendeur a livré ces commandes aux clients."
                    action={bulkDeliverAction.bind(null, campaign.id, group.sellerId)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section id="toutes-les-commandes" className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Toutes les commandes</h2>

        {preparableOrders.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">À préparer</p>
            <BulkFulfilmentForm
              orders={preparableOrders}
              triggerLabel="Marquer comme préparées"
              confirmTitleTemplate="Marquer {count} commande(s) comme préparées ?"
              confirmDescription="Ces commandes seront marquées comme physiquement assemblées."
              action={bulkPrepareAction.bind(null, campaign.id)}
            />
          </div>
        ) : null}

        {fulfilmentRows.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">Vendeur</th>
                  <th className="px-4 py-3 font-medium">Bouteilles</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {fulfilmentRows.map((row) => (
                  <tr
                    key={row.order.id}
                    className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/commandes/${row.order.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.order.customerFirstName} {row.order.customerLastName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.seller ? formatSellerName(row.seller) : "Non attribuée"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {bottleCounts.get(row.order.id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={row.order.status === "DELIVERED" ? "success" : "neutral"}>
                        {orderStatusLabel(row.order.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {orderSourceLabel(row.order.source)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="besoins-en-vin" className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Besoins en vin</h2>
        {wineRequirements.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune quantité requise pour le moment.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Vin</th>
                  <th className="px-4 py-3 font-medium">Bouteilles</th>
                  <th className="px-4 py-3 font-medium">Cartons</th>
                </tr>
              </thead>
              <tbody>
                {wineRequirements.map((requirement: WineRequirementRow) => {
                  const { cartons, looseBottles } = calculateCartonBreakdown(requirement.bottles);
                  return (
                    <tr
                      key={requirement.productId}
                      className="border-border border-b last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium">{requirement.productName}</td>
                      <td className="px-4 py-3 tabular-nums">{requirement.bottles}</td>
                      <td className="text-muted-foreground px-4 py-3 tabular-nums">
                        {cartons} carton{cartons !== 1 ? "s" : ""}
                        {looseBottles > 0
                          ? ` + ${looseBottles} bouteille${looseBottles !== 1 ? "s" : ""}`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
