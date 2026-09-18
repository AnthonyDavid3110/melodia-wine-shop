import type { Money } from "../money";

/**
 * The public read model for the customer-facing catalog (Phase 4 Gate
 * 1/2). Deliberately narrow — only what a visitor's page needs, never
 * admin-only/internal fields (campaign `status`, `active` flags,
 * `defaultSellerTargetAmount`, timestamps, etc.). `Money` stays the
 * existing branded type; formatting happens once, at the UI layer, via
 * `formatCHF()` — never a preformatted string baked in here.
 */

export interface PublicCampaign {
  id: string;
  name: string;
  publicTitle: string | null;
  description: string | null;
}

export interface PublicWine {
  id: string;
  slug: string;
  name: string;
  category: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  grapeVariety: string | null;
  shortDescription: string | null;
  description: string | null;
  tastingNotes: string | null;
  imageUrl: string | null;
  price: Money;
  displayOrder: number;
}

export interface PublicBundleItem {
  productId: string;
  name: string;
  quantity: number;
}

export interface PublicBundle {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  price: Money;
  /** Explicit composition, ordered consistently with each component's CampaignProduct.displayOrder. */
  items: PublicBundleItem[];
  /** Derived: sum of item quantities. */
  bottleCount: number;
  displayOrder: number;
}

/**
 * The two Phase 4 business states. A technical/query failure is
 * deliberately NOT a third state here — it propagates as a thrown
 * error to the nearest Next.js error boundary instead (see
 * src/infrastructure/catalog/get-public-catalog.ts and
 * src/app/error.tsx).
 *
 * "Active campaign with zero visible wines" is intentionally not a
 * separate state — it's `state: "active"` with `wines: []`; the UI
 * distinguishes that case by checking array length, since it still
 * needs the campaign identity to render (Gate 2 §8).
 */
export type PublicCatalog =
  | { state: "no-active-campaign" }
  | { state: "active"; campaign: PublicCampaign; wines: PublicWine[]; bundles: PublicBundle[] };
