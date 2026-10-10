import { asc, eq } from "drizzle-orm";
import { db } from "../database/client";
import { campaignProducts, products, type ProductCategory } from "../database/schema";

export class ProductNotFoundError extends Error {
  constructor(id: string) {
    super(`Produit introuvable (${id}).`);
    this.name = "ProductNotFoundError";
  }
}

export class DuplicateProductSlugError extends Error {
  constructor(slug: string) {
    super(`Le slug « ${slug} » est déjà utilisé par un autre produit.`);
    this.name = "DuplicateProductSlugError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update">;

export interface ProductFieldsInput {
  name: string;
  slug: string;
  producer: string | null;
  /**
   * Deliberately plain `string`, not the `ProductCategory` union —
   * `products.category` is a plain `text` column with no CHECK
   * constraint precisely so future categories beyond WHITE/RED/ROSE
   * don't require a migration (docs/04-DATA-MODEL.md §6, Phase 5
   * Gate 1 §7). `createProduct`/`updateProduct` cast to
   * `ProductCategory` only to satisfy Drizzle's `$type<>` compile-time
   * narrowing — nothing rejects an unlisted value at runtime.
   */
  category: string;
  vintage: number | null;
  region: string | null;
  grapeVariety: string | null;
  shortDescription: string | null;
  description: string | null;
  tastingNotes: string | null;
  imageUrl: string | null;
}

/**
 * `updateProduct()`'s own input (Phase 15, Gate ARCH-006-D review
 * finding) — `imageUrl` is OPTIONAL here, and genuinely matters
 * whether the key is present at all, not just whether its value is
 * `null`: omitting it means the SQL `UPDATE`'s `SET` clause never
 * mentions `image_url` at all, so this write cannot race a concurrent
 * `setProductImage()` call (`removeProductImageAction`, or another
 * concurrent edit) — there is nothing to clobber, because nothing is
 * written. A fresh read immediately before the write would only have
 * narrowed that window, not closed it; excluding the column from the
 * statement itself is the actual fix. Pass `imageUrl: null` to
 * explicitly clear it in the same write as other fields, or omit the
 * key entirely to leave the stored value untouched — never pass
 * `imageUrl: undefined` to mean "clear it".
 */
export type ProductUpdateInput = Omit<ProductFieldsInput, "imageUrl"> & {
  imageUrl?: string | null;
};

/** Alphabetical — the reusable wine library, not campaign-ordered. */
export async function listProducts(dbHandle: DbHandle = db) {
  return dbHandle.select().from(products).orderBy(asc(products.name));
}

export async function getProduct(id: string, dbHandle: DbHandle = db) {
  const [product] = await dbHandle.select().from(products).where(eq(products.id, id));
  return product ?? null;
}

/** Backs `generateUniqueSlug` (Gate 2C §6) — the admin never types a slug. */
export async function productSlugExists(slug: string, dbHandle: DbHandle = db): Promise<boolean> {
  const [row] = await dbHandle
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug));
  return Boolean(row);
}

/**
 * How many campaigns currently reference this product — shown in the
 * admin list/detail so deactivating a product's cross-campaign impact
 * is visible before the admin acts (Phase 5 Gate 1 §6).
 */
export async function countCampaignsUsingProduct(productId: string, dbHandle: DbHandle = db) {
  const rows = await dbHandle
    .select({ campaignId: campaignProducts.campaignId })
    .from(campaignProducts)
    .where(eq(campaignProducts.productId, productId));
  return new Set(rows.map((row) => row.campaignId)).size;
}

function translateSlugViolation(error: unknown, slug: string): never {
  const cause = (error as { cause?: unknown })?.cause;
  if (String(cause).includes("products_slug_unique")) {
    throw new DuplicateProductSlugError(slug);
  }
  throw error;
}

export async function createProduct(input: ProductFieldsInput, dbHandle: DbHandle = db) {
  try {
    const [product] = await dbHandle
      .insert(products)
      .values({ ...input, category: input.category as ProductCategory, active: true })
      .returning();
    if (!product) {
      throw new Error("createProduct: insert returned no row.");
    }
    return product;
  } catch (error) {
    translateSlugViolation(error, input.slug);
  }
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
  dbHandle: DbHandle = db,
) {
  // Destructuring `imageUrl` out and only conditionally spreading it
  // back is what actually keeps it out of the `SET` clause when
  // omitted — a key that was never added to the object is a key
  // Drizzle's `.set()` never sees, not a value needing special
  // undefined-handling.
  const { imageUrl, ...rest } = input;
  const values =
    imageUrl === undefined
      ? { ...rest, category: rest.category as ProductCategory }
      : { ...rest, imageUrl, category: rest.category as ProductCategory };

  try {
    const [product] = await dbHandle
      .update(products)
      .set(values)
      .where(eq(products.id, id))
      .returning();
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  } catch (error) {
    if (error instanceof ProductNotFoundError) throw error;
    translateSlugViolation(error, input.slug);
  }
}

/** The normal "remove" action (Phase 5 Gate 1 §6/§19, Gate 2 deletion-policy correction: no hard delete in the admin UI). */
export async function setProductActive(id: string, active: boolean, dbHandle: DbHandle = db) {
  const [product] = await dbHandle
    .update(products)
    .set({ active })
    .where(eq(products.id, id))
    .returning();
  if (!product) {
    throw new ProductNotFoundError(id);
  }
  return product;
}

/**
 * Surgical single-column write (Phase 15, Gate ARCH-006-D) — same
 * pattern as `setProductActive`, deliberately not routed through
 * `updateProduct()`'s full-row write: callers (the standalone
 * remove-image action, and the create/update actions after a
 * successful Blob upload) only ever know about the image, never need
 * to re-fetch and re-pass every other field just to change this one.
 * Never deletes the underlying Blob object — only ever changes the
 * database reference.
 */
export async function setProductImage(
  id: string,
  imageUrl: string | null,
  dbHandle: DbHandle = db,
) {
  const [product] = await dbHandle
    .update(products)
    .set({ imageUrl })
    .where(eq(products.id, id))
    .returning();
  if (!product) {
    throw new ProductNotFoundError(id);
  }
  return product;
}
