import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { isBundleValid } from "@/domain/catalog/shape-public-catalog";
import { getCampaign } from "@/infrastructure/campaign/campaigns";
import { getBundle, getBundleItems } from "@/infrastructure/campaign/bundles";
import { listCampaignProducts } from "@/infrastructure/campaign/campaign-products";
import { getVisibleProductIds } from "@/infrastructure/campaign/visible-products";
import { BundleForm } from "../bundle-form";
import { CompositionEditor } from "../composition-editor";
import {
  replaceBundleCompositionAction,
  setBundleActiveAction,
  updateBundleAction,
} from "../actions";

function minorUnitsToInputValue(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export default async function EditBundlePage({
  params,
}: {
  params: Promise<{ id: string; bundleId: string }>;
}) {
  await requireAdmin();
  const { id: campaignId, bundleId } = await params;

  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    notFound();
  }
  const bundle = await getBundle(bundleId);
  if (!bundle || bundle.campaignId !== campaignId) {
    notFound();
  }

  const [items, campaignProductRows, visibleProductIds] = await Promise.all([
    getBundleItems(bundleId),
    listCampaignProducts(campaignId),
    getVisibleProductIds(campaignId),
  ]);

  const isValid = isBundleValid(
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
  );

  const toggleActive = setBundleActiveAction.bind(null, campaignId, bundleId, !bundle.active);

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border flex flex-col gap-3 border-b pb-6">
        <Link
          href={`/admin/campagne/${campaignId}`}
          className="text-muted-foreground text-body-sm font-sans hover:underline"
        >
          ← {campaign.name}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-h2">{bundle.name}</h1>
            <div className="flex items-center gap-2">
              <StatusBadge tone={bundle.active ? "success" : "neutral"}>
                {bundle.active ? "Actif" : "Inactif"}
              </StatusBadge>
              <StatusBadge tone={isValid ? "success" : "warning"}>
                {isValid ? "Valide publiquement" : "Invalide publiquement"}
              </StatusBadge>
            </div>
            {!isValid ? (
              <p className="text-warning border-warning text-body-sm max-w-md border-l-2 pl-3 font-sans">
                N&rsquo;apparaîtra pas publiquement tant que sa composition ne comporte que des vins
                visibles de cette campagne.
              </p>
            ) : null}
          </div>
          <form action={toggleActive}>
            <Button type="submit" variant="outline">
              {bundle.active ? "Désactiver" : "Activer"}
            </Button>
          </form>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Informations</h2>
        <BundleForm
          action={updateBundleAction.bind(null, campaignId, bundleId)}
          defaultValues={{
            name: bundle.name,
            shortDescription: bundle.shortDescription,
            description: bundle.description,
            price: minorUnitsToInputValue(bundle.priceAmount),
            imageUrl: bundle.imageUrl,
          }}
          submitLabel="Enregistrer les modifications"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Composition</h2>
        <p className="text-muted-foreground text-body-sm font-sans">
          Seuls les vins déjà attachés à cette campagne peuvent composer ce carton.
        </p>
        <CompositionEditor
          action={replaceBundleCompositionAction.bind(null, campaignId, bundleId)}
          initialItems={items.map(({ item, product }) => ({
            productId: item.productId,
            name: product.name,
            quantity: item.quantity,
          }))}
          candidates={campaignProductRows.map(({ product }) => ({
            productId: product.id,
            name: product.name,
          }))}
        />
      </section>
    </div>
  );
}
