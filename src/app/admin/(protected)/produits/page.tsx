import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { listProducts } from "@/infrastructure/products/products";
import { ProductSearchList } from "./product-search-list";

export default async function ProductsPage() {
  await requireAdmin();
  const products = await listProducts();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Produits"
        description="Données de référence des vins, réutilisées d'une campagne à l'autre."
        action={
          <Button asChild>
            <Link href="/admin/produits/nouveau">Nouveau produit</Link>
          </Button>
        }
      />

      {products.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun produit pour le moment.
        </p>
      ) : (
        <ProductSearchList products={products} />
      )}
    </div>
  );
}
