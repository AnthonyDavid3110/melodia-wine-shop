import { describe, expect, it } from "vitest";
import {
  DuplicateProductSlugError,
  ProductNotFoundError,
  countCampaignsUsingProduct,
  createProduct,
  getProduct,
  listProducts,
  productSlugExists,
  setProductActive,
  updateProduct,
} from "@/infrastructure/products/products";
import { createCampaign } from "@/infrastructure/campaign/campaigns";
import { campaignProducts } from "../schema";
import { unique } from "./fixtures";
import { withRollback } from "./setup";

function fields(overrides: Partial<Parameters<typeof createProduct>[0]> = {}) {
  return {
    name: unique("Wine"),
    slug: unique("wine"),
    producer: null,
    category: "WHITE",
    vintage: null,
    region: null,
    grapeVariety: null,
    shortDescription: null,
    description: null,
    tastingNotes: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("productSlugExists", () => {
  it("reports false for a free slug and true for a taken one (backs Gate 2C automatic slug generation)", async () => {
    await withRollback(async (tx) => {
      const slug = unique("free-slug");
      expect(await productSlugExists(slug, tx)).toBe(false);
      await createProduct(fields({ slug }), tx);
      expect(await productSlugExists(slug, tx)).toBe(true);
    });
  });
});

describe("createProduct", () => {
  it("creates a new active product", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields({ name: "Chasselas Test" }), tx);
      expect(product?.name).toBe("Chasselas Test");
      expect(product?.active).toBe(true);
    });
  });

  it("accepts a category beyond WHITE/RED/ROSE — the field stays open-ended", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields({ category: "ORANGE" }), tx);
      expect(product?.category).toBe("ORANGE");
    });
  });

  it("rejects a duplicate slug with a friendly error", async () => {
    await withRollback(async (tx) => {
      const slug = unique("dup-product");
      await createProduct(fields({ slug }), tx);
      await expect(
        tx.transaction(async (tx2) => createProduct(fields({ slug }), tx2)),
      ).rejects.toThrow(DuplicateProductSlugError);
    });
  });
});

describe("updateProduct", () => {
  it("updates editable fields", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields({ name: "Original" }), tx);
      const updated = await updateProduct(
        product!.id,
        fields({ name: "Updated", slug: product!.slug, region: "Valais" }),
        tx,
      );
      expect(updated?.name).toBe("Updated");
      expect(updated?.region).toBe("Valais");
    });
  });

  it("throws ProductNotFoundError for a nonexistent id", async () => {
    await withRollback(async (tx) => {
      await expect(
        updateProduct("00000000-0000-0000-0000-000000000000", fields(), tx),
      ).rejects.toThrow(ProductNotFoundError);
    });
  });
});

describe("setProductActive", () => {
  it("deactivates and reactivates a product", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields(), tx);
      const deactivated = await setProductActive(product!.id, false, tx);
      expect(deactivated.active).toBe(false);

      const reactivated = await setProductActive(product!.id, true, tx);
      expect(reactivated.active).toBe(true);
    });
  });

  it("throws ProductNotFoundError for a nonexistent id", async () => {
    await withRollback(async (tx) => {
      await expect(
        setProductActive("00000000-0000-0000-0000-000000000000", false, tx),
      ).rejects.toThrow(ProductNotFoundError);
    });
  });
});

describe("listProducts / getProduct", () => {
  it("lists products alphabetically and getProduct fetches one by id", async () => {
    await withRollback(async (tx) => {
      const b = await createProduct(fields({ name: `B-${unique("x")}` }), tx);
      const a = await createProduct(fields({ name: `A-${unique("x")}` }), tx);

      const all = await listProducts(tx);
      const indexA = all.findIndex((p) => p.id === a!.id);
      const indexB = all.findIndex((p) => p.id === b!.id);
      expect(indexA).toBeLessThan(indexB);

      const fetched = await getProduct(a!.id, tx);
      expect(fetched?.id).toBe(a!.id);

      expect(await getProduct("00000000-0000-0000-0000-000000000000", tx)).toBeNull();
    });
  });
});

describe("countCampaignsUsingProduct", () => {
  it("counts distinct campaigns referencing a product", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields(), tx);
      expect(await countCampaignsUsingProduct(product!.id, tx)).toBe(0);

      const campaign1 = await createCampaign(
        {
          name: unique("C1"),
          slug: unique("c1"),
          publicTitle: null,
          description: null,
          openingDate: null,
          closingDate: null,
          defaultSellerTargetAmount: null,
        },
        tx,
      );
      await tx.insert(campaignProducts).values({
        campaignId: campaign1!.id,
        productId: product!.id,
        unitPriceAmount: 1800,
      });

      expect(await countCampaignsUsingProduct(product!.id, tx)).toBe(1);
    });
  });
});
