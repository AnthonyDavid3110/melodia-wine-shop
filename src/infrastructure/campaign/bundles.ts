import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../database/client";
import { bundleItems, bundles, campaignProducts, products } from "../database/schema";

export class BundleNotFoundError extends Error {
  constructor(id: string) {
    super(`Carton introuvable (${id}).`);
    this.name = "BundleNotFoundError";
  }
}

export class DuplicateBundleSlugError extends Error {
  constructor(slug: string) {
    super(`Le slug « ${slug} » est déjà utilisé par un autre carton.`);
    this.name = "DuplicateBundleSlugError";
  }
}

export class DuplicateBundleComponentError extends Error {
  constructor() {
    super("Un même vin ne peut apparaître qu'une seule fois dans la composition du carton.");
    this.name = "DuplicateBundleComponentError";
  }
}

export class InvalidBundleComponentError extends Error {
  constructor() {
    super("Un des vins sélectionnés n'appartient pas à cette campagne.");
    this.name = "InvalidBundleComponentError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "delete" | "transaction">;

export interface BundleFieldsInput {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  /** Minor units. */
  priceAmount: number;
  imageUrl: string | null;
}

export async function listCampaignBundles(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select()
    .from(bundles)
    .where(eq(bundles.campaignId, campaignId))
    .orderBy(asc(bundles.displayOrder));
}

export async function getBundle(id: string, dbHandle: DbHandle = db) {
  const [bundle] = await dbHandle.select().from(bundles).where(eq(bundles.id, id));
  return bundle ?? null;
}

/** Backs `generateUniqueSlug` (Gate 2C §6) — the admin never types a slug. Bundle slugs are globally unique, not per-campaign. */
export async function bundleSlugExists(slug: string, dbHandle: DbHandle = db): Promise<boolean> {
  const [row] = await dbHandle
    .select({ id: bundles.id })
    .from(bundles)
    .where(eq(bundles.slug, slug));
  return Boolean(row);
}

/** A bundle's current composition, joined with each component's master Product name. */
export async function getBundleItems(bundleId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select({ item: bundleItems, product: products })
    .from(bundleItems)
    .innerJoin(products, eq(bundleItems.productId, products.id))
    .where(eq(bundleItems.bundleId, bundleId));
}

function translateBundleSlugViolation(error: unknown, slug: string): never {
  const cause = (error as { cause?: unknown })?.cause;
  if (String(cause).includes("bundles_slug_unique")) {
    throw new DuplicateBundleSlugError(slug);
  }
  throw error;
}

export async function createBundle(
  campaignId: string,
  input: BundleFieldsInput,
  dbHandle: DbHandle = db,
) {
  try {
    // Must `await` here, not `return dbHandle.transaction(...)` directly —
    // returning the un-awaited promise would let a later rejection
    // escape this function's `try` before `catch` ever runs.
    return await dbHandle.transaction(async (tx) => {
      const existingOrders = await tx
        .select({ displayOrder: bundles.displayOrder })
        .from(bundles)
        .where(eq(bundles.campaignId, campaignId));
      const nextOrder =
        existingOrders.length > 0
          ? Math.max(...existingOrders.map((row) => row.displayOrder)) + 1
          : 0;

      const [bundle] = await tx
        .insert(bundles)
        .values({ campaignId, ...input, active: true, displayOrder: nextOrder })
        .returning();
      if (!bundle) {
        throw new Error("createBundle: insert returned no row.");
      }
      return bundle;
    });
  } catch (error) {
    translateBundleSlugViolation(error, input.slug);
  }
}

export async function updateBundleFields(
  id: string,
  input: BundleFieldsInput,
  dbHandle: DbHandle = db,
) {
  try {
    const [bundle] = await dbHandle
      .update(bundles)
      .set(input)
      .where(eq(bundles.id, id))
      .returning();
    if (!bundle) {
      throw new BundleNotFoundError(id);
    }
    return bundle;
  } catch (error) {
    if (error instanceof BundleNotFoundError) throw error;
    translateBundleSlugViolation(error, input.slug);
  }
}

/** The normal "hide/show" action — never a hard delete. */
export async function setBundleActive(id: string, active: boolean, dbHandle: DbHandle = db) {
  const [bundle] = await dbHandle
    .update(bundles)
    .set({ active })
    .where(eq(bundles.id, id))
    .returning();
  if (!bundle) {
    throw new BundleNotFoundError(id);
  }
  return bundle;
}

export interface BundleCompositionItemInput {
  productId: string;
  quantity: number;
}

/**
 * Replaces a bundle's entire composition transactionally (Gate 2B §7).
 * All validation — duplicate component, cross-campaign component —
 * happens before any write, and the delete+insert both happen inside
 * one transaction, so a rejected or failed replacement leaves the
 * previous composition completely intact (the transaction never
 * commits the delete without a successful insert).
 */
export async function replaceBundleComposition(
  bundleId: string,
  campaignId: string,
  items: readonly BundleCompositionItemInput[],
  dbHandle: DbHandle = db,
) {
  await dbHandle.transaction(async (tx) => {
    const [bundle] = await tx.select().from(bundles).where(eq(bundles.id, bundleId));
    if (!bundle || bundle.campaignId !== campaignId) {
      throw new BundleNotFoundError(bundleId);
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.productId)) {
        throw new DuplicateBundleComponentError();
      }
      seen.add(item.productId);
    }

    if (items.length > 0) {
      const eligibleRows = await tx
        .select({ productId: campaignProducts.productId })
        .from(campaignProducts)
        .where(
          and(
            eq(campaignProducts.campaignId, campaignId),
            inArray(
              campaignProducts.productId,
              items.map((item) => item.productId),
            ),
          ),
        );
      const eligibleIds = new Set(eligibleRows.map((row) => row.productId));
      for (const item of items) {
        if (!eligibleIds.has(item.productId)) {
          throw new InvalidBundleComponentError();
        }
      }
    }

    await tx.delete(bundleItems).where(eq(bundleItems.bundleId, bundleId));
    if (items.length > 0) {
      await tx
        .insert(bundleItems)
        .values(
          items.map((item) => ({ bundleId, productId: item.productId, quantity: item.quantity })),
        );
    }
  });
}
