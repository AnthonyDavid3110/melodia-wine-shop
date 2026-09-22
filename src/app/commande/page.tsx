import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { listActiveCampaignSellers } from "@/infrastructure/campaign/campaign-sellers";
import { isOnlinePaymentAvailable } from "@/infrastructure/payments/online-payments";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { CartCampaignSync } from "@/components/cart/cart-campaign-sync";
import { H1 } from "@/components/ui/typography";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Commande",
  robots: { index: false, follow: false },
};

/**
 * Force-dynamic for the same reason as `/` and `/panier` (Phase 4 Gate
 * 2 / Phase 6): a raw `pg` connection gives Next no Dynamic API signal
 * on its own, and checkout must always resolve the live campaign/prices
 * — never a cached snapshot.
 */
export const dynamic = "force-dynamic";

/**
 * The Phase 7 checkout page. A Server Component that fetches the same
 * authoritative `getPublicCatalog()` `/` and `/panier` do (so
 * `CartCampaignSync` always has a real campaign id) plus the eligible
 * seller list for this campaign (Phase 7 §10, BR-SEL-002) — checkout is
 * simply unreachable without an active campaign (BR-CAM-002).
 */
export default async function CheckoutPage() {
  const catalog = await getPublicCatalog();
  if (catalog.state !== "active") {
    redirect("/");
  }

  const eligibleSellers = await listActiveCampaignSellers(catalog.campaign.id);
  const sellerOptions = eligibleSellers.map((seller) => ({
    value: seller.id,
    label: formatSellerName(seller),
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <CartCampaignSync campaignId={catalog.campaign.id} />
      <PublicHeader catalog={catalog} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:px-8">
        <H1 className="text-2xl">Commande</H1>
        <div className="mt-8">
          <CheckoutForm
            catalog={catalog}
            sellerOptions={sellerOptions}
            onlinePaymentAvailable={isOnlinePaymentAvailable()}
          />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
