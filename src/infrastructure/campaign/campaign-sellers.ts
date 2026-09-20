import { and, asc, eq } from "drizzle-orm";
import { db } from "../database/client";
import { campaignSellers, campaigns, sellers } from "../database/schema";
import { CampaignNotFoundError } from "./campaigns";
import { SellerNotFoundError } from "../sellers/sellers";

export class CampaignSellerNotFoundError extends Error {
  constructor(id: string) {
    super(`Participation de vendeur introuvable (${id}).`);
    this.name = "CampaignSellerNotFoundError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

/** Campaign sellers joined with their master Seller, alphabetical. */
export async function listCampaignSellers(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select({ campaignSeller: campaignSellers, seller: sellers })
    .from(campaignSellers)
    .innerJoin(sellers, eq(campaignSellers.sellerId, sellers.id))
    .where(eq(campaignSellers.campaignId, campaignId))
    .orderBy(asc(sellers.lastName), asc(sellers.firstName));
}

/**
 * Publicly eligible sellers for the given campaign (Phase 7 §10,
 * BR-SEL-002) — `Seller.active AND CampaignSeller.active`, scoped to
 * this campaign. This is the ONE query both `/commande`'s seller
 * combobox and its server-side re-validation use, and the same one
 * `/admin/commandes/nouvelle` reuses (docs/10 §48 — manual orders use
 * the "SAME seller eligibility rules"). Never exposes inactive/foreign-
 * campaign sellers, unlike `listCampaignSellers` (admin-only, includes
 * inactive rows for management purposes).
 */
export async function listActiveCampaignSellers(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select({ id: sellers.id, firstName: sellers.firstName, lastName: sellers.lastName })
    .from(campaignSellers)
    .innerJoin(sellers, eq(campaignSellers.sellerId, sellers.id))
    .where(
      and(
        eq(campaignSellers.campaignId, campaignId),
        eq(campaignSellers.active, true),
        eq(sellers.active, true),
      ),
    )
    .orderBy(asc(sellers.lastName), asc(sellers.firstName));
}

/** Active Sellers not yet participating in this campaign (active or inactive row) — the "add" picker's candidates. */
export async function listAttachableSellers(campaignId: string, dbHandle: DbHandle = db) {
  const attached = await dbHandle
    .select({ sellerId: campaignSellers.sellerId })
    .from(campaignSellers)
    .where(eq(campaignSellers.campaignId, campaignId));
  const attachedIds = new Set(attached.map((row) => row.sellerId));

  const active = await dbHandle
    .select()
    .from(sellers)
    .where(eq(sellers.active, true))
    .orderBy(asc(sellers.lastName), asc(sellers.firstName));
  return active.filter((seller) => !attachedIds.has(seller.id));
}

/**
 * Adds a Seller to a campaign, with an optional target override
 * (`null` = inherit the campaign default). Reactivates an existing
 * inactive CampaignSeller row instead of duplicating it, mirroring
 * `attachProductToCampaign`.
 */
export async function addSellerToCampaign(
  campaignId: string,
  sellerId: string,
  targetAmount: number | null,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (!campaign) {
      throw new CampaignNotFoundError(campaignId);
    }
    const [seller] = await tx
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.id, sellerId));
    if (!seller) {
      throw new SellerNotFoundError(sellerId);
    }

    const [existing] = await tx
      .select()
      .from(campaignSellers)
      .where(
        and(eq(campaignSellers.campaignId, campaignId), eq(campaignSellers.sellerId, sellerId)),
      );

    if (existing) {
      const [updated] = await tx
        .update(campaignSellers)
        .set({ active: true, targetAmount })
        .where(eq(campaignSellers.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await tx
      .insert(campaignSellers)
      .values({ campaignId, sellerId, active: true, targetAmount })
      .returning();
    return created!;
  });
}

/** The normal "remove from campaign" action — never a hard delete. */
export async function setCampaignSellerActive(
  id: string,
  active: boolean,
  dbHandle: DbHandle = db,
) {
  const [updated] = await dbHandle
    .update(campaignSellers)
    .set({ active })
    .where(eq(campaignSellers.id, id))
    .returning();
  if (!updated) {
    throw new CampaignSellerNotFoundError(id);
  }
  return updated;
}

/** `targetAmount: null` explicitly returns the seller to "use the campaign default". */
export async function setCampaignSellerTarget(
  id: string,
  targetAmount: number | null,
  dbHandle: DbHandle = db,
) {
  const [updated] = await dbHandle
    .update(campaignSellers)
    .set({ targetAmount })
    .where(eq(campaignSellers.id, id))
    .returning();
  if (!updated) {
    throw new CampaignSellerNotFoundError(id);
  }
  return updated;
}

export interface BulkAddResult {
  added: number;
  reactivated: number;
}

/**
 * "Ajouter tous les vendeurs actifs" (Gate 2B §12) — adds every
 * globally active Seller not yet participating, and reactivates any
 * existing-but-inactive participation, all in one transaction. Idempotent:
 * running it again with nothing changed in between adds/reactivates
 * nothing (every seller is already an active participant).
 */
export async function bulkAddActiveSellers(
  campaignId: string,
  dbHandle: DbHandle = db,
): Promise<BulkAddResult> {
  return dbHandle.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (!campaign) {
      throw new CampaignNotFoundError(campaignId);
    }

    const activeSellers = await tx.select().from(sellers).where(eq(sellers.active, true));
    const existingRows = await tx
      .select()
      .from(campaignSellers)
      .where(eq(campaignSellers.campaignId, campaignId));
    const existingBySellerId = new Map(existingRows.map((row) => [row.sellerId, row]));

    let added = 0;
    let reactivated = 0;
    for (const seller of activeSellers) {
      const existing = existingBySellerId.get(seller.id);
      if (!existing) {
        await tx
          .insert(campaignSellers)
          .values({ campaignId, sellerId: seller.id, active: true, targetAmount: null });
        added++;
      } else if (!existing.active) {
        await tx
          .update(campaignSellers)
          .set({ active: true })
          .where(eq(campaignSellers.id, existing.id));
        reactivated++;
      }
    }

    return { added, reactivated };
  });
}
