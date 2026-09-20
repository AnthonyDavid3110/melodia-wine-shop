import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Body, H2, Metadata, Price } from "@/components/ui/typography";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { formatCHF, money } from "@/domain/money";
import {
  customerPaymentStatusLabel,
  orderSourceLabel,
  sellerSettlementStatusLabel,
} from "@/domain/orders/order-labels";
import { getSeller } from "@/infrastructure/sellers/sellers";
import { getActiveCampaign } from "@/infrastructure/campaign/campaigns";
import {
  countSettlementOrders,
  getSellerFinancialSummary,
  listEligibleOrdersForSettlement,
  listSellerCampaignOrders,
  listSellerSettlements,
} from "@/infrastructure/settlements/settlements";
import { SellerForm } from "../seller-form";
import { setSellerActiveAction, updateSellerAction } from "../actions";
import { SettlementCreationForm } from "./settlement-creation-form";

export default async function EditSellerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const seller = await getSeller(id);
  if (!seller) {
    notFound();
  }

  const toggleActive = setSellerActiveAction.bind(null, id, !seller.active);
  const activeCampaign = await getActiveCampaign();

  return (
    <div className="flex flex-col gap-10">
      <div className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-h2">{formatSellerName(seller)}</h1>
          <StatusBadge tone={seller.active ? "success" : "neutral"}>
            {seller.active ? "Actif" : "Inactif"}
          </StatusBadge>
        </div>
        <form action={toggleActive}>
          <Button type="submit" variant="outline">
            {seller.active ? "Désactiver" : "Activer"}
          </Button>
        </form>
      </div>

      <SellerForm
        action={updateSellerAction.bind(null, id)}
        defaultValues={seller}
        submitLabel="Enregistrer les modifications"
      />

      {activeCampaign ? (
        <SellerCampaignSections
          sellerId={id}
          campaignId={activeCampaign.id}
          campaignName={activeCampaign.name}
        />
      ) : (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne active — les informations financières de campagne ne sont pas disponibles
          pour le moment.
        </p>
      )}
    </div>
  );
}

/**
 * The campaign-scoped financial sections (Phase 8 §18/§19). Always
 * scoped to one explicit campaign — the active one, for this V1
 * workflow — never an implicit aggregate across every campaign this
 * seller has ever participated in.
 */
async function SellerCampaignSections({
  sellerId,
  campaignId,
  campaignName,
}: {
  sellerId: string;
  campaignId: string;
  campaignName: string;
}) {
  const [financial, campaignOrders, eligibleOrders, settlementRows] = await Promise.all([
    getSellerFinancialSummary(sellerId, campaignId),
    listSellerCampaignOrders(sellerId, campaignId),
    listEligibleOrdersForSettlement(sellerId, campaignId),
    listSellerSettlements(sellerId, campaignId),
  ]);

  const settlementCounts = await Promise.all(
    settlementRows.map((row) => countSettlementOrders(row.settlement.id)),
  );

  return (
    <>
      <Metadata as="p">Campagne : {campaignName}</Metadata>

      <section className="flex flex-col gap-3">
        <H2 className="text-xl">Performance</H2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground font-sans">Ventes</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.sales)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Objectif</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.target)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Progression</dt>
            <dd className="font-medium tabular-nums">
              {financial.progress}%{financial.progress >= 100 ? " · Objectif atteint" : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <H2 className="text-xl">Position financière</H2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground font-sans">À encaisser auprès des clients</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.stillToCollect)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Encaissé auprès des clients</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.collected)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">À remettre à Mélodia</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.stillToRemit)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Déjà remis à Mélodia</dt>
            <dd className="font-medium tabular-nums">{formatCHF(financial.remittedToEcm)}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <H2 className="text-xl">Commandes de la campagne</H2>
        {campaignOrders.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucune commande attribuée pour cette campagne.
          </p>
        ) : (
          <div className="border-border overflow-x-auto border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-border bg-surface-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Commande</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Paiement client</th>
                  <th className="px-4 py-3 font-medium">Règlement</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {campaignOrders.map((row) => (
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
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatCHF(money(row.order.totalAmount))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={row.order.customerPaymentStatus === "PAID" ? "success" : "warning"}
                      >
                        {customerPaymentStatusLabel(row.order.customerPaymentStatus)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={
                          row.order.sellerSettlementStatus === "SETTLED" ? "success" : "neutral"
                        }
                      >
                        {sellerSettlementStatusLabel(row.order.sellerSettlementStatus)}
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

      <section className="flex flex-col gap-3">
        <H2 className="text-xl">Enregistrer un règlement</H2>
        <SettlementCreationForm
          sellerId={sellerId}
          campaignId={campaignId}
          eligibleOrders={eligibleOrders.map((row) => ({
            id: row.order.id,
            orderNumber: row.order.orderNumber,
            customerName: `${row.order.customerFirstName} ${row.order.customerLastName}`,
            totalAmount: row.order.totalAmount,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <H2 className="text-xl">Historique des règlements</H2>
        {settlementRows.length === 0 ? (
          <p className="text-muted-foreground text-body-sm font-sans">
            Aucun règlement enregistré.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {settlementRows.map((row, index) => (
              <li
                key={row.settlement.id}
                className="border-border flex flex-col gap-1 border-b pb-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Body className="font-medium">
                    {row.settlement.settledAt?.toLocaleDateString("fr-CH") ?? "—"}
                  </Body>
                  <Metadata as="p">{settlementCounts[index]} commande(s)</Metadata>
                </div>
                <Price>{formatCHF(money(row.settlement.amount))}</Price>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
