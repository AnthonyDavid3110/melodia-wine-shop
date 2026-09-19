import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { getSeller } from "@/infrastructure/sellers/sellers";
import { SellerForm } from "../seller-form";
import { setSellerActiveAction, updateSellerAction } from "../actions";

export default async function EditSellerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const seller = await getSeller(id);
  if (!seller) {
    notFound();
  }

  const toggleActive = setSellerActiveAction.bind(null, id, !seller.active);

  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
