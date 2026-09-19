import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "../product-form";
import { createProductAction } from "../actions";

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nouveau produit"
        description="Données de référence du vin — indépendantes de toute campagne."
      />
      <ProductForm action={createProductAction} submitLabel="Créer le produit" />
    </div>
  );
}
