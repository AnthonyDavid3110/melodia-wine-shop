import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { SellerForm } from "../seller-form";
import { createSellerAction } from "../actions";

export default async function NewSellerPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nouveau vendeur"
        description="Données de référence du membre — indépendantes de toute campagne."
      />
      <SellerForm action={createSellerAction} submitLabel="Créer le vendeur" />
    </div>
  );
}
