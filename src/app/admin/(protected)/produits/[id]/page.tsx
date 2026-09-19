import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { countCampaignsUsingProduct, getProduct } from "@/infrastructure/products/products";
import { ProductForm } from "../product-form";
import { setProductActiveAction, updateProductAction } from "../actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) {
    notFound();
  }

  const campaignCount = await countCampaignsUsingProduct(id);
  const toggleActive = setProductActiveAction.bind(null, id, !product.active);

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-h2">{product.name}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge tone={product.active ? "success" : "neutral"}>
              {product.active ? "Actif" : "Inactif"}
            </StatusBadge>
            <span className="text-muted-foreground text-body-sm font-sans">
              {campaignCount === 0
                ? "Utilisé par aucune campagne"
                : campaignCount === 1
                  ? "Utilisé par 1 campagne"
                  : `Utilisé par ${campaignCount} campagnes`}
            </span>
          </div>
        </div>
        <form action={toggleActive}>
          <Button type="submit" variant="outline">
            {product.active ? "Désactiver" : "Activer"}
          </Button>
        </form>
      </div>

      {product.active && campaignCount > 0 ? (
        <p className="border-warning text-muted-foreground text-body-sm border-l-2 pl-3 font-sans">
          Ce produit est utilisé par au moins une campagne. Le désactiver le retirera de tout
          affichage public actif.
        </p>
      ) : null}

      <ProductForm
        action={updateProductAction.bind(null, id)}
        defaultValues={product}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
