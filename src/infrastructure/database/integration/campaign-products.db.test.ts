import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  CampaignProductNotFoundError,
  attachProductToCampaign,
  listAttachableProducts,
  listCampaignProducts,
  moveCampaignProduct,
  setCampaignProductActive,
  setCampaignProductPrice,
} from "@/infrastructure/campaign/campaign-products";
import { CampaignNotFoundError } from "@/infrastructure/campaign/campaigns";
import { ProductNotFoundError } from "@/infrastructure/products/products";
import { createBaseFixtures, unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";
import { products } from "../schema";

async function extraProduct(tx: Tx, label = "Extra") {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique(label.toLowerCase()), name: unique(label), category: "RED" })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  return product;
}

describe("attachProductToCampaign", () => {
  it("attaches a product at the given campaign price", async () => {
    const attached = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      return attachProductToCampaign(campaign.id, product.id, 1_800, tx);
    });
    expect(attached.unitPriceAmount).toBe(1_800);
    expect(attached.active).toBe(true);
    expect(attached.displayOrder).toBe(0);
  });

  it("assigns increasing display order to successive attachments", async () => {
    const orders = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const second = await extraProduct(tx, "Second");
      const first = await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      const secondAttached = await attachProductToCampaign(campaign.id, second.id, 1_000, tx);
      return [first.displayOrder, secondAttached.displayOrder];
    });
    expect(orders).toEqual([0, 1]);
  });

  it("reactivates and re-prices an existing inactive row instead of duplicating it", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const first = await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      await setCampaignProductActive(first.id, false, tx);
      const reattached = await attachProductToCampaign(campaign.id, product.id, 1_500, tx);
      const rows = await listCampaignProducts(campaign.id, tx);
      return {
        reattachedId: reattached.id,
        firstId: first.id,
        price: reattached.unitPriceAmount,
        rowCount: rows.length,
      };
    });
    expect(result.reattachedId).toBe(result.firstId);
    expect(result.price).toBe(1_500);
    expect(result.rowCount).toBe(1);
  });

  it("rejects an unknown campaign", async () => {
    await expect(
      withRollback(async (tx) => {
        const { product } = await createBaseFixtures(tx);
        return attachProductToCampaign(randomUUID(), product.id, 1_000, tx);
      }),
    ).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("rejects an unknown product", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        return attachProductToCampaign(campaign.id, randomUUID(), 1_000, tx);
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});

describe("listAttachableProducts", () => {
  it("excludes products already attached (active or inactive) and globally inactive products", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const attachedInactive = await extraProduct(tx, "AttachedInactive");
      const neverAttached = await extraProduct(tx, "NeverAttached");
      const globallyInactive = await extraProduct(tx, "GloballyInactive");
      await tx.update(products).set({ active: false }).where(eq(products.id, globallyInactive.id));

      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      const inactiveRow = await attachProductToCampaign(
        campaign.id,
        attachedInactive.id,
        1_000,
        tx,
      );
      await setCampaignProductActive(inactiveRow.id, false, tx);

      const rows = await listAttachableProducts(campaign.id, tx);
      return { names: rows.map((p) => p.name), neverAttachedName: neverAttached.name };
    });
    expect(result.names).toContain(result.neverAttachedName);
    expect(result.names.some((n) => n.startsWith("AttachedInactive"))).toBe(false);
    expect(result.names.some((n) => n.startsWith("GloballyInactive"))).toBe(false);
  });
});

describe("setCampaignProductPrice / setCampaignProductActive", () => {
  it("updates price", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const row = await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      return setCampaignProductPrice(row.id, 2_000, tx);
    });
    expect(updated.unitPriceAmount).toBe(2_000);
  });

  it("toggles campaign-scoped visibility", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const row = await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      return setCampaignProductActive(row.id, false, tx);
    });
    expect(updated.active).toBe(false);
  });

  it("throws CampaignProductNotFoundError for an unknown row", async () => {
    await expect(
      withRollback((tx) => setCampaignProductPrice(randomUUID(), 1_000, tx)),
    ).rejects.toBeInstanceOf(CampaignProductNotFoundError);
    await expect(
      withRollback((tx) => setCampaignProductActive(randomUUID(), true, tx)),
    ).rejects.toBeInstanceOf(CampaignProductNotFoundError);
  });
});

describe("moveCampaignProduct", () => {
  it("moves a product up and persists the new order", async () => {
    const orders = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const second = await extraProduct(tx, "Second");
      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      const secondAttached = await attachProductToCampaign(campaign.id, second.id, 1_000, tx);
      await moveCampaignProduct(campaign.id, secondAttached.id, "up", tx);
      const rows = await listCampaignProducts(campaign.id, tx);
      return rows.map((r) => r.campaignProduct.displayOrder).sort((a, b) => a - b);
    });
    expect(orders).toEqual([0, 1]);
  });

  it("moving the first item up and the last item down are no-ops that still succeed", async () => {
    await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const row = await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      await moveCampaignProduct(campaign.id, row.id, "up", tx);
      await moveCampaignProduct(campaign.id, row.id, "down", tx);
    });
  });

  it("repeated moves converge to the expected order", async () => {
    const names = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const b = await extraProduct(tx, "B");
      const c = await extraProduct(tx, "C");
      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      await attachProductToCampaign(campaign.id, b.id, 1_000, tx);
      const rowC = await attachProductToCampaign(campaign.id, c.id, 1_000, tx);

      await moveCampaignProduct(campaign.id, rowC.id, "up", tx);
      await moveCampaignProduct(campaign.id, rowC.id, "up", tx);
      const rows = await listCampaignProducts(campaign.id, tx);
      return rows
        .sort((a, b) => a.campaignProduct.displayOrder - b.campaignProduct.displayOrder)
        .map((r) => r.product.name);
    });
    expect(names[0]!.startsWith("C")).toBe(true);
  });

  it("throws CampaignProductNotFoundError for an unknown row", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        return moveCampaignProduct(campaign.id, randomUUID(), "up", tx);
      }),
    ).rejects.toBeInstanceOf(CampaignProductNotFoundError);
  });
});
