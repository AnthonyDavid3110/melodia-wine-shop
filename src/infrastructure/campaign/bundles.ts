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

/**
 * `updateBundleFields()`'s own input (Phase 15, Gate ARCH-006-E,
 * mirrors `ProductUpdateInput` in `products.ts` exactly) — `imageUrl`
 * is OPTIONAL here, and it is the KEY's presence that matters, not
 * just its value. Omitting the key means the SQL `UPDATE`'s `SET`
 * clause never mentions `image_url` at all, so this write cannot race
 * a concurrent `setBundleImage()` call (the standalone remove action,
 * or another concurrent edit) — there is nothing to clobber, because
 * nothing is written. Pass `imageUrl: null` to explicitly clear it in
 * the same write as other fields, or omit the key entirely to leave
 * the stored value untouched — never pass `imageUrl: undefined` to
 * mean "clear it".
 */
export type BundleUpdateInput = Omit<BundleFieldsInput, "imageUrl"> & {
  imageUrl?: string | null;
};

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
  input: BundleUpdateInput,
  dbHandle: DbHandle = db,
) {
  // Destructuring `imageUrl` out and only conditionally spreading it
  // back is what actually keeps it out of the `SET` clause when
  // omitted — a key that was never added to the object is a key
  // Drizzle's `.set()` never sees, not a value needing special
  // undefined-handling (same technique as `updateProduct()`).
  const { imageUrl, ...rest } = input;
  const values = imageUrl === undefined ? rest : { ...rest, imageUrl };

  try {
    const [bundle] = await dbHandle
      .update(bundles)
      .set(values)
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

/**
 * The normal "hide/show" action — never a hard delete. Campaign
 * ownership enforced directly in the `WHERE` clause (Gate ARCH-006-E
 * final-security-fix): a confirmed pre-existing gap meant a direct
 * Server Action call with a mismatched `campaignId`/`bundleId` pair
 * could toggle a bundle belonging to a different campaign, the same
 * "hiding a button is not authorization" issue already closed for
 * `updateBundleAction`/`setBundleImage` during Gate ARCH-006-E. A
 * single atomic `UPDATE ... WHERE id = ? AND campaign_id = ?` is
 * simpler than `setBundleImage()`'s read-then-write-in-transaction
 * shape — `active` has no intermediate business logic between an
 * existence check and the write, so there is nothing a transaction
 * would need to protect that the `WHERE` clause doesn't already. A
 * mismatched campaign is reported identically to a nonexistent bundle
 * (`BundleNotFoundError`), never distinguished.
 */
export async function setBundleActive(
  id: string,
  campaignId: string,
  active: boolean,
  dbHandle: DbHandle = db,
) {
  const [bundle] = await dbHandle
    .update(bundles)
    .set({ active })
    .where(and(eq(bundles.id, id), eq(bundles.campaignId, campaignId)))
    .returning();
  if (!bundle) {
    throw new BundleNotFoundError(id);
  }
  return bundle;
}

/**
 * Surgical single-column write (Phase 15, Gate ARCH-006-E — mirrors
 * `setProductImage()` in `products.ts`), with one addition products
 * don't need: bundles are campaign-scoped, so this independently
 * re-verifies `campaignId` ownership inside the SAME transaction as
 * the write — never trusting that a caller (e.g. a Server Action)
 * already checked it, the same "hiding a button is not authorization"
 * posture already applied everywhere else in this codebase. A
 * mismatched campaign is reported identically to a nonexistent bundle
 * (`BundleNotFoundError`), never distinguished, so this never confirms
 * to a caller that a given bundle id exists under a different
 * campaign. Never deletes the underlying Blob object — only ever
 * changes the database reference.
 */
export async function setBundleImage(
  bundleId: string,
  campaignId: string,
  imageUrl: string | null,
  dbHandle: DbHandle = db,
) {
  return dbHandle.transaction(async (tx) => {
    const [existing] = await tx.select().from(bundles).where(eq(bundles.id, bundleId));
    if (!existing || existing.campaignId !== campaignId) {
      throw new BundleNotFoundError(bundleId);
    }

    const [bundle] = await tx
      .update(bundles)
      .set({ imageUrl })
      .where(eq(bundles.id, bundleId))
      .returning();
    if (!bundle) {
      throw new BundleNotFoundError(bundleId);
    }
    return bundle;
  });
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
