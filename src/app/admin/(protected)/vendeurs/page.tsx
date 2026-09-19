import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { listSellers } from "@/infrastructure/sellers/sellers";
import { SellerSearchList } from "./seller-search-list";

export default async function SellersPage() {
  await requireAdmin();
  const sellers = await listSellers();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Vendeurs"
        description="Membres ECM pouvant recevoir une attribution de ventes, indépendamment de toute campagne."
        action={
          <Button asChild>
            <Link href="/admin/vendeurs/nouveau">Nouveau vendeur</Link>
          </Button>
        }
      />

      {sellers.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun vendeur pour le moment.
        </p>
      ) : (
        <SellerSearchList sellers={sellers} />
      )}
    </div>
  );
}
