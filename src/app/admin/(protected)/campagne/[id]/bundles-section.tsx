import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { isBundleValid } from "@/domain/catalog/shape-public-catalog";
import { getBundleItems, listCampaignBundles } from "@/infrastructure/campaign/bundles";
import { getVisibleProductIds } from "@/infrastructure/campaign/visible-products";

export async function BundlesSection({ campaignId }: { campaignId: string }) {
  const [bundles, visibleProductIds] = await Promise.all([
    listCampaignBundles(campaignId),
    getVisibleProductIds(campaignId),
  ]);

  const validityByBundleId = new Map<string, boolean>();
  for (const bundle of bundles) {
    const items = await getBundleItems(bundle.id);
    validityByBundleId.set(
      bundle.id,
      isBundleValid(
        {
          id: bundle.id,
          slug: bundle.slug,
          name: bundle.name,
          shortDescription: bundle.shortDescription,
          description: bundle.description,
          imageUrl: bundle.imageUrl,
          priceAmount: bundle.priceAmount,
          displayOrder: bundle.displayOrder,
          items: items.map(({ item }) => ({ productId: item.productId, quantity: item.quantity })),
        },
        visibleProductIds,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-body-sm font-sans">
        Un carton n&rsquo;apparaît publiquement que si tous ses composants sont des vins visibles de
        cette campagne — jamais avec une composition partielle ou cassée.
      </p>

      {bundles.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun carton pour cette campagne.
        </p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-3 py-2 font-medium">Carton</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Validité publique</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => {
                const isValid = validityByBundleId.get(bundle.id) ?? false;
                return (
                  <tr
                    key={bundle.id}
                    className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/admin/campagne/${campaignId}/bundles/${bundle.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {bundle.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={bundle.active ? "success" : "neutral"}>
                        {bundle.active ? "Actif" : "Inactif"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={isValid ? "success" : "warning"}>
                        {isValid ? "Valide" : "Invalide"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-border border-t pt-4">
        <Button asChild>
          <Link href={`/admin/campagne/${campaignId}/bundles/nouveau`}>Nouveau carton</Link>
        </Button>
      </div>
    </div>
  );
}
