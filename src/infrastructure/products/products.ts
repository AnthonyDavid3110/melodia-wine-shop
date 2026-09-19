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
  input: ProductFieldsInput,
  dbHandle: DbHandle = db,
) {
  try {
    const [product] = await dbHandle
      .update(products)
      .set({ ...input, category: input.category as ProductCategory })
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
