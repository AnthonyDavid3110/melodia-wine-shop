import { and, asc, eq } from "drizzle-orm";
import { moveOrderedItem } from "@/domain/campaign/ordering";
import { db } from "../database/client";
import { campaignProducts, campaigns, products } from "../database/schema";
import { CampaignNotFoundError } from "./campaigns";
import { ProductNotFoundError } from "../products/products";

export class CampaignProductNotFoundError extends Error {
  constructor(id: string) {
    super(`Vin de campagne introuvable (${id}).`);
    this.name = "CampaignProductNotFoundError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

/** Campaign products joined with their master Product, ordered for display. */
export async function listCampaignProducts(campaignId: string, dbHandle: DbHandle = db) {
  return dbHandle
    .select({ campaignProduct: campaignProducts, product: products })
    .from(campaignProducts)
    .innerJoin(products, eq(campaignProducts.productId, products.id))
    .where(eq(campaignProducts.campaignId, campaignId))
    .orderBy(asc(campaignProducts.displayOrder));
}

/**
 * Active master Products not yet represented by any CampaignProduct row
 * (active or inactive) for this campaign — the "add existing product"
 * picker's candidate list (Gate 2B §2): a product already attached,
 * even if currently hidden, is offered as a reactivation on its own
 * row instead, never as a second "new attachment" option.
 */
export async function listAttachableProducts(campaignId: string, dbHandle: DbHandle = db) {
  const attached = await dbHandle
    .select({ productId: campaignProducts.productId })
    .from(campaignProducts)
    .where(eq(campaignProducts.campaignId, campaignId));
  const attachedIds = new Set(attached.map((row) => row.productId));

  const active = await dbHandle
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name));
  return active.filter((product) => !attachedIds.has(product.id));
}

/**
 * Attaches a Product to a campaign at the given campaign-specific
 * price. If a CampaignProduct row already exists (active or inactive),
 * this reactivates and re-prices it instead of inserting a duplicate —
 * the unique constraint on (campaignId, productId) would reject a
 * blind insert anyway, but this makes the intended "reactivate, don't
 * duplicate" behavior explicit rather than an error path.
 */
export async function attachProductToCampaign(
  campaignId: string,
  productId: string,
  unitPriceAmount: number,
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
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    const [existing] = await tx
      .select()
      .from(campaignProducts)
      .where(
        and(eq(campaignProducts.campaignId, campaignId), eq(campaignProducts.productId, productId)),
      );

    if (existing) {
      const [updated] = await tx
        .update(campaignProducts)
        .set({ active: true, unitPriceAmount })
        .where(eq(campaignProducts.id, existing.id))
        .returning();
      return updated!;
    }

    const existingOrders = await tx
      .select({ displayOrder: campaignProducts.displayOrder })
      .from(campaignProducts)
      .where(eq(campaignProducts.campaignId, campaignId));
    const nextOrder =
      existingOrders.length > 0
        ? Math.max(...existingOrders.map((row) => row.displayOrder)) + 1
        : 0;

    const [created] = await tx
      .insert(campaignProducts)
      .values({ campaignId, productId, unitPriceAmount, active: true, displayOrder: nextOrder })
      .returning();
    return created!;
  });
}

export async function setCampaignProductPrice(
  id: string,
  unitPriceAmount: number,
  dbHandle: DbHandle = db,
) {
  const [updated] = await dbHandle
    .update(campaignProducts)
    .set({ unitPriceAmount })
    .where(eq(campaignProducts.id, id))
    .returning();
  if (!updated) {
    throw new CampaignProductNotFoundError(id);
  }
  return updated;
}

/** The normal "hide/show for this campaign" action — never a hard delete. */
export async function setCampaignProductActive(
  id: string,
  active: boolean,
  dbHandle: DbHandle = db,
) {
  const [updated] = await dbHandle
    .update(campaignProducts)
    .set({ active })
    .where(eq(campaignProducts.id, id))
    .returning();
  if (!updated) {
    throw new CampaignProductNotFoundError(id);
  }
  return updated;
}

/**
 * Move-up/move-down only (Gate 2B §4, no drag-and-drop). Re-fetches the
 * full campaign's rows inside the transaction, reorders with the pure
 * `moveOrderedItem`, and persists the densely-renumbered result — safe
 * against any pre-existing gaps/collisions in stored `displayOrder`.
 */
export async function moveCampaignProduct(
  campaignId: string,
  campaignProductId: string,
  direction: "up" | "down",
  dbHandle: DbHandle = db,
) {
  await dbHandle.transaction(async (tx) => {
    const rows = await tx
      .select({ id: campaignProducts.id, displayOrder: campaignProducts.displayOrder })
      .from(campaignProducts)
      .where(eq(campaignProducts.campaignId, campaignId));

    if (!rows.some((row) => row.id === campaignProductId)) {
      throw new CampaignProductNotFoundError(campaignProductId);
    }

    const reordered = moveOrderedItem(rows, campaignProductId, direction);
    for (const item of reordered) {
      await tx
        .update(campaignProducts)
        .set({ displayOrder: item.displayOrder })
        .where(eq(campaignProducts.id, item.id));
    }
  });
}
