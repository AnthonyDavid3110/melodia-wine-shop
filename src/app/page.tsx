import { cache } from "react";
import type { Metadata } from "next";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { PublicHeader } from "@/components/public/header";
import { Hero } from "@/components/public/hero";
import { WineCollection } from "@/components/public/wine-collection";
import { EmptySelectionNotice } from "@/components/public/empty-selection-notice";
import { DiscoveryBoxSection } from "@/components/public/discovery-box";
import { DeliverySection } from "@/components/public/delivery-section";
import { EcmSection } from "@/components/public/ecm-section";
import { PublicFooter } from "@/components/public/footer";
import { NoActiveCampaignNotice } from "@/components/public/no-active-campaign-notice";

/**
 * `getPublicCatalog()` isn't a `fetch()` call, so Next's automatic
 * per-request fetch memoization doesn't cover it — both
 * `generateMetadata` and the page body need the same result, so this
 * wraps it with React's `cache()` exactly as Next's own docs recommend
 * ("React cache can be used if fetch is unavailable" —
 * generate-metadata.md), the same pattern already used for
 * request-scoped memoization in src/lib/auth/dal.ts.
 */
const getCachedPublicCatalog = cache(getPublicCatalog);

/**
 * `getPublicCatalog()` reads through a raw `pg` connection, not
 * `fetch()`, so Next has no Dynamic API/uncached-fetch signal to
 * automatically treat this route as dynamic — without this it gets
 * prerendered once at build time (verified: the build output showed
 * `/` as `○ (Static)`), which would freeze in whatever campaign state
 * existed at build time and never reflect a later admin change. Gate 2
 * decision: dynamic rendering is appropriate for V1, no premature ISR.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCachedPublicCatalog();
  if (catalog.state !== "active") {
    return { alternates: { canonical: "/" } };
  }

  const title = catalog.campaign.publicTitle ?? catalog.campaign.name;
  const description = catalog.campaign.description ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, type: "website" },
  };
}

/**
 * The real public storefront (Phase 4 Gate 2), replacing the
 * create-next-app placeholder. Server Component, dynamic rendering — a
 * technical/query failure is NOT caught here; it propagates to
 * src/app/error.tsx (Gate 1/2: business states vs. technical errors
 * stay distinct).
 */
export default async function HomePage() {
  const catalog = await getCachedPublicCatalog();

  if (catalog.state === "no-active-campaign") {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <PublicHeader />
        <NoActiveCampaignNotice />
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader />
      <Hero campaign={catalog.campaign} />
      {catalog.wines.length > 0 ? (
        <WineCollection wines={catalog.wines} />
      ) : (
        <EmptySelectionNotice />
      )}
      <DiscoveryBoxSection bundles={catalog.bundles} />
      <DeliverySection />
      <EcmSection />
      <PublicFooter />
    </div>
  );
}
