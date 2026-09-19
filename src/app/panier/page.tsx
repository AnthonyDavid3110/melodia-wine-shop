import type { Metadata } from "next";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { CartCampaignSync } from "@/components/cart/cart-campaign-sync";
import { CartView } from "@/components/cart/cart-view";
import { H1 } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Panier",
  robots: { index: false, follow: false },
};

/**
 * Force-dynamic for the same reason as `/` (Phase 4 Gate 2): this reads
 * through a raw `pg` connection, not `fetch()`, so Next has no
 * Dynamic API signal to infer dynamic rendering on its own. The
 * catalogue must always be current — cart prices/availability are
 * resolved against it fresh on every visit, never cached.
 */
export const dynamic = "force-dynamic";

/**
 * The dedicated cart page (Phase 6, `docs/05-ARCHITECTURE.md` §8). A
 * Server Component that fetches the same authoritative
 * `getPublicCatalog()` the homepage does, so `CartCampaignSync` always
 * has a real campaign id to reconcile against and `CartView` always
 * resolves prices/availability from current data — never from anything
 * persisted client-side (`05-ARCHITECTURE.md` §19/§20).
 */
export default async function CartPage() {
  const catalog = await getPublicCatalog();
  const campaignId = catalog.state === "active" ? catalog.campaign.id : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {campaignId ? <CartCampaignSync campaignId={campaignId} /> : null}
      <PublicHeader catalog={catalog} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8">
        <H1 className="text-2xl">Panier</H1>
        <div className="mt-8">
          <CartView catalog={catalog} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
