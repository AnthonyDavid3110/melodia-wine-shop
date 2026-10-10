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
  setProductImage,
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

  it("omitting imageUrl from the input leaves the stored value completely untouched — proves the SQL UPDATE never mentions that column (Gate ARCH-006-D concurrency fix)", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(
        fields({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/x.jpg",
        }),
        tx,
      );

      // Build an update input with every field EXCEPT imageUrl — not
      // `imageUrl: undefined`, the key itself is absent.
      const { imageUrl: _imageUrl, ...withoutImageUrl } = fields({
        name: "Updated name",
        slug: product!.slug,
      });
      void _imageUrl;

      const updated = await updateProduct(product!.id, withoutImageUrl, tx);

      expect(updated?.name).toBe("Updated name");
      expect(updated?.imageUrl).toBe(
        "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/x.jpg",
      );
    });
  });

  it("a concurrent-style interleaving — setProductImage() between read and updateProduct() — is never clobbered when imageUrl is omitted", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(
        fields({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/old.jpg",
        }),
        tx,
      );

      // Simulates another request's concurrent image removal landing
      // BETWEEN this request reading the product and writing its own
      // (unrelated field) update.
      await setProductImage(product!.id, null, tx);

      const { imageUrl: _imageUrl, ...withoutImageUrl } = fields({
        name: "Renamed concurrently",
        slug: product!.slug,
      });
      void _imageUrl;
      const updated = await updateProduct(product!.id, withoutImageUrl, tx);

      // The concurrent removal survives — this write never touched
      // the column at all, so there was nothing to clobber it with.
      expect(updated?.imageUrl).toBeNull();
      expect(updated?.name).toBe("Renamed concurrently");
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

describe("setProductImage (Phase 15, Gate ARCH-006-D)", () => {
  it("sets imageUrl on the correct product, by id, and leaves every other column untouched", async () => {
    await withRollback(async (tx) => {
      const other = await createProduct(fields({ name: `Other-${unique("x")}` }), tx);
      const target = await createProduct(
        fields({
          name: `Target-${unique("x")}`,
          producer: "Domaine Test",
          category: "RED",
        }),
        tx,
      );

      const updated = await setProductImage(
        target!.id,
        "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/x.jpg",
        tx,
      );

      expect(updated.id).toBe(target!.id);
      expect(updated.imageUrl).toBe(
        "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/x.jpg",
      );
      // No unintended column updates — every other field is exactly
      // what createProduct wrote, untouched by this call.
      expect(updated.name).toBe(target!.name);
      expect(updated.producer).toBe("Domaine Test");
      expect(updated.category).toBe("RED");
      expect(updated.active).toBe(target!.active);
      expect(updated.slug).toBe(target!.slug);

      // Correct ID filtering: the OTHER product was never touched.
      const unchangedOther = await getProduct(other!.id, tx);
      expect(unchangedOther?.imageUrl).toBeNull();
    });
  });

  it("nulls imageUrl (the removal path) without affecting other columns", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(
        fields({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/products/x.jpg",
        }),
        tx,
      );

      const updated = await setProductImage(product!.id, null, tx);

      expect(updated.imageUrl).toBeNull();
      expect(updated.name).toBe(product!.name);
    });
  });

  it("is idempotent — nulling an already-null imageUrl succeeds trivially", async () => {
    await withRollback(async (tx) => {
      const product = await createProduct(fields({ imageUrl: null }), tx);

      const first = await setProductImage(product!.id, null, tx);
      const second = await setProductImage(product!.id, null, tx);

      expect(first.imageUrl).toBeNull();
      expect(second.imageUrl).toBeNull();
    });
  });

  it("throws ProductNotFoundError for a nonexistent id, without creating any row", async () => {
    await withRollback(async (tx) => {
      await expect(
        setProductImage("00000000-0000-0000-0000-000000000000", null, tx),
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
