import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  campaignEventTypeForTransition,
  isValidCampaignTransition,
  type CampaignStatus,
} from "@/domain/campaign/campaign-status";
import { resolveActiveCampaign } from "@/domain/catalog/resolve-active-campaign";
import { db } from "../database/client";
import { campaignEvents, campaigns, orders } from "../database/schema";

export class InvalidCampaignTransitionError extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Impossible de passer la campagne de « ${from} » à « ${to} ».`);
    this.name = "InvalidCampaignTransitionError";
  }
}

export class AnotherCampaignAlreadyActiveError extends Error {
  constructor(activeName?: string) {
    super(
      activeName
        ? `Une autre campagne est déjà active : « ${activeName} ». Clôturez-la d'abord.`
        : "Une autre campagne est déjà active. Clôturez-la d'abord.",
    );
    this.name = "AnotherCampaignAlreadyActiveError";
  }
}

export class CampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Campagne introuvable (${id}).`);
    this.name = "CampaignNotFoundError";
  }
}

export class DuplicateCampaignSlugError extends Error {
  constructor(slug: string) {
    super(`Le slug « ${slug} » est déjà utilisé par une autre campagne.`);
    this.name = "DuplicateCampaignSlugError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

export interface CampaignFieldsInput {
  name: string;
  slug: string;
  publicTitle: string | null;
  description: string | null;
  openingDate: Date | null;
  closingDate: Date | null;
  /** Minor units. */
  defaultSellerTargetAmount: number | null;
}

/** Newest first — a small, fixed-size admin list, no pagination needed at this scale. */
export async function listCampaigns(dbHandle: DbHandle = db) {
  return dbHandle.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(id: string, dbHandle: DbHandle = db) {
  const [campaign] = await dbHandle.select().from(campaigns).where(eq(campaigns.id, id));
  return campaign ?? null;
}

/**
 * The single ACTIVE campaign, or `null` if none — same
 * `resolveActiveCampaign` invariant check `get-public-catalog.ts` uses
 * (throws if the `campaigns_one_active_idx` DB invariant were ever
 * violated, never silently picks one). Phase 8's seller-detail page
 * uses this to default its campaign context explicitly and safely
 * (Phase 8 §18) — never an implicit/unscoped aggregate across every
 * campaign a seller has ever participated in.
 */
export async function getActiveCampaign(dbHandle: DbHandle = db) {
  const activeCampaigns = await dbHandle
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "ACTIVE"));
  return resolveActiveCampaign(activeCampaigns);
}

/** Backs `generateUniqueSlug` (Gate 2C §6) — the admin never types a slug. */
export async function campaignSlugExists(slug: string, dbHandle: DbHandle = db): Promise<boolean> {
  const [row] = await dbHandle
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, slug));
  return Boolean(row);
}

function translateSlugViolation(error: unknown, slug: string): never {
  const cause = (error as { cause?: unknown })?.cause;
  if (String(cause).includes("campaigns_slug_unique")) {
    throw new DuplicateCampaignSlugError(slug);
  }
  throw error;
}

/** New campaigns always start DRAFT — status is never client-supplied at creation. */
export async function createCampaign(input: CampaignFieldsInput, dbHandle: DbHandle = db) {
  try {
    const [campaign] = await dbHandle
      .insert(campaigns)
      .values({ ...input, status: "DRAFT" })
      .returning();
    if (!campaign) {
      throw new Error("createCampaign: insert returned no row.");
    }
    return campaign;
  } catch (error) {
    translateSlugViolation(error, input.slug);
  }
}

export async function updateCampaignFields(
  id: string,
  input: CampaignFieldsInput,
  dbHandle: DbHandle = db,
) {
  try {
    const [campaign] = await dbHandle
      .update(campaigns)
      .set(input)
      .where(eq(campaigns.id, id))
      .returning();
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }
    return campaign;
  } catch (error) {
    if (error instanceof CampaignNotFoundError) throw error;
    translateSlugViolation(error, input.slug);
  }
}

/**
 * Validates the transition, updates status, and records the
 * `campaignEvents` row in one transaction (Phase 5 Gate 1/2A —
 * deliberately narrow: lifecycle transitions only, never a
 * field-level audit). The database's `campaigns_one_active_idx`
 * remains the final backstop against a second ACTIVE campaign; this
 * catches that specific violation and translates it into
 * `AnotherCampaignAlreadyActiveError` rather than letting a raw
 * constraint error reach the admin.
 */
export async function transitionCampaignStatus(
  id: string,
  to: CampaignStatus,
  adminUserId: string,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, id));
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }

    const from = campaign.status as CampaignStatus;
    if (!isValidCampaignTransition(from, to)) {
      throw new InvalidCampaignTransitionError(from, to);
    }

    if (to === "ACTIVE") {
      const [conflicting] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.status, "ACTIVE"), ne(campaigns.id, id)));
      if (conflicting) {
        throw new AnotherCampaignAlreadyActiveError(conflicting.name);
      }
    }

    let updated;
    try {
      [updated] = await tx
        .update(campaigns)
        .set({ status: to })
        .where(eq(campaigns.id, id))
        .returning();
    } catch (error) {
      // The pre-check above is a friendlier error message in the
      // common case; this catches the real backstop — two concurrent
      // activations racing past the pre-check simultaneously — via
      // the database's own `campaigns_one_active_idx` constraint.
      const cause = (error as { cause?: unknown })?.cause;
      if (String(cause).includes("campaigns_one_active_idx")) {
        throw new AnotherCampaignAlreadyActiveError();
      }
      throw error;
    }
    if (!updated) {
      throw new CampaignNotFoundError(id);
    }

    await tx.insert(campaignEvents).values({
      campaignId: id,
      type: campaignEventTypeForTransition(from, to),
      adminUserId,
    });

    return updated;
  });
}

/**
 * Campaigns fulfilment work can meaningfully happen against (Phase 9
 * §8/§22) — ACTIVE or CLOSED, newest first. Excludes DRAFT (no public
 * orders can exist yet, BR-CAM-002) and ARCHIVED (docs/10 §100:
 * archival only happens once all operational/financial work is already
 * complete, so it must never become — or remain offered as — an
 * operational fulfilment target). Backs both the `/admin/preparation`
 * campaign selector and its default-resolution logic below.
 */
export async function listFulfilmentRelevantCampaigns(dbHandle: DbHandle = db) {
  return dbHandle
    .select()
    .from(campaigns)
    .where(inArray(campaigns.status, ["ACTIVE", "CLOSED"]))
    .orderBy(desc(campaigns.createdAt));
}

/**
 * The default `/admin/preparation` campaign context (Phase 9 §8 —
 * explicit deviation from the read-only inspection's "no ACTIVE ->
 * unavailable" recommendation). Preparation/handoff/delivery must
 * continue after a campaign closes, so unlike `getActiveCampaign()`
 * this never returns `null` merely because nothing is ACTIVE: it falls
 * back to the most recently created CLOSED campaign that actually has
 * orders (preferred, since that is the one still requiring physical
 * work), or otherwise the most recently created CLOSED campaign at all.
 * Only `null` when no ACTIVE/CLOSED campaign exists whatsoever.
 */
export async function resolveDefaultFulfilmentCampaign(dbHandle: DbHandle = db) {
  const active = await getActiveCampaign(dbHandle);
  if (active) {
    return active;
  }

  const closedCampaigns = await dbHandle
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "CLOSED"))
    .orderBy(desc(campaigns.createdAt));
  if (closedCampaigns.length === 0) {
    return null;
  }

  const campaignIds = closedCampaigns.map((campaign) => campaign.id);
  const orderRows = await dbHandle
    .select({ campaignId: orders.campaignId })
    .from(orders)
    .where(inArray(orders.campaignId, campaignIds));
  const campaignIdsWithOrders = new Set(orderRows.map((row) => row.campaignId));

  return (
    closedCampaigns.find((campaign) => campaignIdsWithOrders.has(campaign.id)) ??
    closedCampaigns[0]!
  );
}

/**
 * Campaigns `/admin/statistiques` can meaningfully report on (Phase 13
 * Gate 13C) — ACTIVE, CLOSED, or ARCHIVED, newest first. Unlike
 * `listFulfilmentRelevantCampaigns()`, ARCHIVED is deliberately
 * INCLUDED: statistics are historical/analytical, not operational, and
 * BR-CAM-003 explicitly requires "statistics" to remain available after
 * a campaign is archived. DRAFT is excluded — a DRAFT campaign can
 * never have any orders yet (BR-CAM-002), so it would always show an
 * empty page.
 */
export async function listStatisticsRelevantCampaigns(dbHandle: DbHandle = db) {
  return dbHandle
    .select()
    .from(campaigns)
    .where(inArray(campaigns.status, ["ACTIVE", "CLOSED", "ARCHIVED"]))
    .orderBy(desc(campaigns.createdAt));
}

/**
 * The default `/admin/statistiques` campaign context — same shape as
 * `resolveDefaultFulfilmentCampaign()` (ACTIVE first, else the most
 * recently created historical campaign that actually has orders, else
 * the most recently created historical campaign at all), but over the
 * ACTIVE ∪ CLOSED ∪ ARCHIVED population above rather than ACTIVE ∪
 * CLOSED. Kept as its own small function rather than parametrizing the
 * fulfilment resolver — the two serve different, independently-approved
 * populations and this keeps each one simple to read on its own.
 */
export async function resolveDefaultStatisticsCampaign(dbHandle: DbHandle = db) {
  const active = await getActiveCampaign(dbHandle);
  if (active) {
    return active;
  }

  const historicalCampaigns = await dbHandle
    .select()
    .from(campaigns)
    .where(inArray(campaigns.status, ["CLOSED", "ARCHIVED"]))
    .orderBy(desc(campaigns.createdAt));
  if (historicalCampaigns.length === 0) {
    return null;
  }

  const campaignIds = historicalCampaigns.map((campaign) => campaign.id);
  const orderRows = await dbHandle
    .select({ campaignId: orders.campaignId })
    .from(orders)
    .where(inArray(orders.campaignId, campaignIds));
  const campaignIdsWithOrders = new Set(orderRows.map((row) => row.campaignId));

  return (
    historicalCampaigns.find((campaign) => campaignIdsWithOrders.has(campaign.id)) ??
    historicalCampaigns[0]!
  );
}

export async function listCampaignEvents(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select()
    .from(campaignEvents)
    .where(eq(campaignEvents.campaignId, campaignId))
    .orderBy(desc(campaignEvents.createdAt));
}
