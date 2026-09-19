import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCHF, money } from "@/domain/money";
import { effectiveSellerTarget } from "@/domain/campaign/seller-target";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import {
  listAttachableSellers,
  listCampaignSellers,
} from "@/infrastructure/campaign/campaign-sellers";
import { getCampaign } from "@/infrastructure/campaign/campaigns";
import { AddSellerForm } from "./add-seller-form";
import { BulkAddSellersButton } from "./bulk-add-sellers-button";
import { SellerTargetForm } from "./seller-target-form";
import {
  addCampaignSellerAction,
  setCampaignSellerActiveAction,
  setCampaignSellerTargetAction,
} from "./sellers-actions";

function minorUnitsToInputValue(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export async function CampaignSellersSection({ campaignId }: { campaignId: string }) {
  const [rows, attachable, campaign] = await Promise.all([
    listCampaignSellers(campaignId),
    listAttachableSellers(campaignId),
    getCampaign(campaignId),
  ]);
  const campaignDefault = campaign?.defaultSellerTargetAmount ?? null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-body-sm font-sans">
        Objectif de la campagne :{" "}
        {campaignDefault != null ? formatCHF(money(campaignDefault)) : "aucun"}. Un objectif
        spécifique le remplace pour un vendeur donné ; laisser vide pour utiliser le défaut.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun vendeur pour cette campagne.
        </p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-3 py-2 font-medium">Vendeur</th>
                <th className="px-3 py-2 font-medium">Objectif spécifique</th>
                <th className="px-3 py-2 font-medium">Objectif effectif</th>
                <th className="px-3 py-2 font-medium">Participation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ campaignSeller, seller }) => {
                const effective = effectiveSellerTarget(
                  campaignSeller.targetAmount,
                  campaignDefault,
                );
                const sellerLabel = formatSellerName(seller);
                const usesDefault = campaignSeller.targetAmount == null;
                const toggleActive = setCampaignSellerActiveAction.bind(
                  null,
                  campaignId,
                  campaignSeller.id,
                  !campaignSeller.active,
                );
                return (
                  <tr
                    key={campaignSeller.id}
                    className="border-border border-b align-top last:border-b-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{sellerLabel}</td>
                    <td className="px-3 py-2">
                      <SellerTargetForm
                        action={setCampaignSellerTargetAction.bind(
                          null,
                          campaignId,
                          campaignSeller.id,
                        )}
                        defaultValue={
                          campaignSeller.targetAmount != null
                            ? minorUnitsToInputValue(campaignSeller.targetAmount)
                            : ""
                        }
                        sellerLabel={sellerLabel}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {effective != null ? formatCHF(money(effective)) : "—"}
                      {usesDefault ? (
                        <span className="text-muted-foreground text-body-sm font-sans">
                          {" "}
                          (défaut)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={campaignSeller.active ? "success" : "neutral"}>
                          {campaignSeller.active ? "Participe" : "Retiré"}
                        </StatusBadge>
                        <form action={toggleActive}>
                          <Button type="submit" variant="outline" size="sm">
                            {campaignSeller.active ? "Retirer" : "Réintégrer"}
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-border flex flex-col gap-3 border-t pt-4">
        <p className="text-label font-sans">Ajouter un vendeur</p>
        <BulkAddSellersButton campaignId={campaignId} />
        <AddSellerForm
          action={addCampaignSellerAction.bind(null, campaignId)}
          options={attachable.map((seller) => ({
            value: seller.id,
            label: formatSellerName(seller),
          }))}
        />
      </div>
    </div>
  );
}
