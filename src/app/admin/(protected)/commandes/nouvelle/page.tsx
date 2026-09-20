import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { listActiveCampaignSellers } from "@/infrastructure/campaign/campaign-sellers";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { ManualOrderForm } from "./manual-order-form";

export default async function NewManualOrderPage() {
  await requireAdmin();
  const catalog = await getPublicCatalog();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nouvelle commande"
        description="Saisie d'un bon de commande papier — utilise le même moteur de création et les mêmes prix que le site public."
      />

      {catalog.state !== "active" ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune campagne active. Impossible de créer une commande.
        </p>
      ) : (
        <ManualOrderForm
          catalog={catalog}
          sellerOptions={(await listActiveCampaignSellers(catalog.campaign.id)).map((seller) => ({
            value: seller.id,
            label: formatSellerName(seller),
          }))}
        />
      )}
    </div>
  );
}
