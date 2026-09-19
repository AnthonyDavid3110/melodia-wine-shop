import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  listAttachableProducts,
  listCampaignProducts,
} from "@/infrastructure/campaign/campaign-products";
import { getBundleItems, listCampaignBundles } from "@/infrastructure/campaign/bundles";
import {
  attachCampaignProductAction,
  moveCampaignProductAction,
  setCampaignProductActiveAction,
  setCampaignProductPriceAction,
} from "./campaign-products-actions";
import { AttachProductForm } from "./attach-product-form";
import { PriceEditForm } from "./price-edit-form";

/** Minor units to a plain decimal input value — e.g. 1800 -> "18.00" — the inverse of `parseCHF`. */
function minorUnitsToInputValue(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export async function CampaignProductsSection({ campaignId }: { campaignId: string }) {
  const [rows, attachable, activeBundles] = await Promise.all([
    listCampaignProducts(campaignId),
    listAttachableProducts(campaignId),
    listCampaignBundles(campaignId).then((bundles) => bundles.filter((b) => b.active)),
  ]);

  // Which visible-in-a-bundle products belong to at least one ACTIVE
  // bundle, so hiding one can be flagged before/after the fact (Gate 2B §5)
  // rather than leaving the admin to discover the breakage later.
  const bundleNamesByProductId = new Map<string, string[]>();
  for (const bundle of activeBundles) {
    const items = await getBundleItems(bundle.id);
    for (const { item } of items) {
      const names = bundleNamesByProductId.get(item.productId) ?? [];
      names.push(bundle.name);
      bundleNamesByProductId.set(item.productId, names);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-body-sm font-sans">
        « Actif au catalogue » est l&rsquo;état global du produit (page Produits). « Visible pour
        cette campagne » détermine si ce vin apparaît dans <em>cette</em> campagne. Les deux doivent
        être vrais pour qu&rsquo;un vin soit visible publiquement.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun vin attaché à cette campagne.
        </p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-3 py-2 font-medium">Vin</th>
                <th className="px-3 py-2 font-medium">Actif au catalogue</th>
                <th className="px-3 py-2 font-medium">Prix (CHF)</th>
                <th className="px-3 py-2 font-medium">Cette campagne</th>
                <th className="px-3 py-2 font-medium">Publiquement visible</th>
                <th className="px-3 py-2 font-medium">Ordre</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ campaignProduct, product }, index) => {
                const publiclyVisible = product.active && campaignProduct.active;
                const usedInBundles = bundleNamesByProductId.get(product.id) ?? [];
                const toggleActive = setCampaignProductActiveAction.bind(
                  null,
                  campaignId,
                  campaignProduct.id,
                  !campaignProduct.active,
                );
                const moveUp = moveCampaignProductAction.bind(
                  null,
                  campaignId,
                  campaignProduct.id,
                  "up",
                );
                const moveDown = moveCampaignProductAction.bind(
                  null,
                  campaignId,
                  campaignProduct.id,
                  "down",
                );

                return (
                  <tr
                    key={campaignProduct.id}
                    className="border-border border-b align-top last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{product.name}</p>
                      {usedInBundles.length > 0 ? (
                        <p className="text-warning text-body-sm mt-1 font-sans">
                          Utilisé dans : {usedInBundles.join(", ")}. Le masquer rendra{" "}
                          {usedInBundles.length > 1 ? "ces cartons" : "ce carton"} invalide
                          publiquement.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusBadge tone={product.active ? "success" : "neutral"}>
                        {product.active ? "Actif" : "Inactif au catalogue global"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <PriceEditForm
                        action={setCampaignProductPriceAction.bind(
                          null,
                          campaignId,
                          campaignProduct.id,
                        )}
                        defaultValue={minorUnitsToInputValue(campaignProduct.unitPriceAmount)}
                        productLabel={product.name}
                      />
                      {campaignProduct.unitPriceAmount === 0 ? (
                        <p className="text-warning text-body-sm mt-1 font-sans">Prix à zéro</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <form action={toggleActive}>
                        <Button type="submit" variant="outline" size="sm">
                          {campaignProduct.active
                            ? "Masquer pour cette campagne"
                            : "Rendre visible pour cette campagne"}
                        </Button>
                      </form>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={publiclyVisible ? "success" : "neutral"}>
                        {publiclyVisible ? "Oui" : "Non"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <form action={moveUp}>
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={index === 0}
                            aria-label={`Monter ${product.name}`}
                          >
                            ↑
                          </Button>
                        </form>
                        <form action={moveDown}>
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={index === rows.length - 1}
                            aria-label={`Descendre ${product.name}`}
                          >
                            ↓
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

      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <p className="text-label font-sans">Ajouter un vin</p>
        <AttachProductForm
          action={attachCampaignProductAction.bind(null, campaignId)}
          options={attachable.map((product) => ({ value: product.id, label: product.name }))}
        />
      </div>
    </div>
  );
}
