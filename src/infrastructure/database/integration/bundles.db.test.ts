import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BundleNotFoundError,
  DuplicateBundleComponentError,
  DuplicateBundleSlugError,
  InvalidBundleComponentError,
  bundleSlugExists,
  createBundle,
  getBundle,
  getBundleItems,
  listCampaignBundles,
  replaceBundleComposition,
  setBundleActive,
  setBundleImage,
  updateBundleFields,
} from "@/infrastructure/campaign/bundles";
import { attachProductToCampaign } from "@/infrastructure/campaign/campaign-products";
import { createBaseFixtures, unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";
import { products } from "../schema";

function bundleInput(overrides: Partial<Parameters<typeof createBundle>[1]> = {}) {
  return {
    name: unique("Carton"),
    slug: unique("carton"),
    shortDescription: null,
    description: null,
    priceAmount: 12_000,
    imageUrl: null,
    ...overrides,
  };
}

async function extraProduct(tx: Tx, label = "Extra") {
  const [product] = await tx
    .insert(products)
    .values({ slug: unique(label.toLowerCase()), name: unique(label), category: "RED" })
    .returning();
  if (!product) throw new Error("fixture insert failed");
  return product;
}

describe("bundleSlugExists", () => {
  it("reports false for a free slug and true for a taken one (backs Gate 2C automatic slug generation)", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const slug = unique("free-slug");
      expect(await bundleSlugExists(slug, tx)).toBe(false);
      await createBundle(campaign.id, bundleInput({ slug }), tx);
      expect(await bundleSlugExists(slug, tx)).toBe(true);
    });
  });
});

describe("createBundle / updateBundleFields / setBundleActive", () => {
  it("creates a bundle with display order 0 for the first bundle in a campaign", async () => {
    const bundle = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      return createBundle(campaign.id, bundleInput(), tx);
    });
    expect(bundle!.active).toBe(true);
    expect(bundle!.displayOrder).toBe(0);
  });

  it("rejects a duplicate slug", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        const slug = unique("dup-carton");
        await createBundle(campaign.id, bundleInput({ slug }), tx);
        return createBundle(campaign.id, bundleInput({ slug }), tx);
      }),
    ).rejects.toBeInstanceOf(DuplicateBundleSlugError);
  });

  it("updates fields, preserving whatever imageUrl the caller submits", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(
        campaign.id,
        bundleInput({ imageUrl: "https://example.test/x.jpg" }),
        tx,
      );
      return updateBundleFields(
        bundle!.id,
        bundleInput({
          name: "Nouveau nom",
          slug: bundle!.slug,
          imageUrl: "https://example.test/x.jpg",
        }),
        tx,
      );
    });
    expect(updated!.name).toBe("Nouveau nom");
    expect(updated!.imageUrl).toBe("https://example.test/x.jpg");
  });

  it("throws BundleNotFoundError for update/setActive on an unknown id", async () => {
    await expect(
      withRollback((tx) => updateBundleFields(randomUUID(), bundleInput(), tx)),
    ).rejects.toBeInstanceOf(BundleNotFoundError);
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        return setBundleActive(randomUUID(), campaign.id, false, tx);
      }),
    ).rejects.toBeInstanceOf(BundleNotFoundError);
  });

  it("toggles active without a hard delete", async () => {
    const bundle = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const created = await createBundle(campaign.id, bundleInput(), tx);
      return setBundleActive(created!.id, campaign.id, false, tx);
    });
    expect(bundle.active).toBe(false);
  });

  it("rejects setBundleActive when campaignId does not match the bundle's owner, without leaking that the bundle exists under a different campaign", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const other = await createBaseFixtures(tx);
      const created = await createBundle(campaign.id, bundleInput(), tx);

      await expect(setBundleActive(created!.id, other.campaign.id, false, tx)).rejects.toThrow(
        new BundleNotFoundError(created!.id).message,
      );

      const unchanged = await getBundle(created!.id, tx);
      expect(unchanged?.active).toBe(true);
    });
  });

  it("omitting imageUrl from the input leaves the stored value completely untouched — proves the SQL UPDATE never mentions that column (Gate ARCH-006-E)", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(
        campaign.id,
        bundleInput({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/x.jpg",
        }),
        tx,
      );

      // Build an update input with every field EXCEPT imageUrl — not
      // `imageUrl: undefined`, the key itself is absent.
      const { imageUrl: _imageUrl, ...withoutImageUrl } = bundleInput({
        name: "Updated name",
        slug: bundle!.slug,
      });
      void _imageUrl;

      return updateBundleFields(bundle!.id, withoutImageUrl, tx);
    });

    expect(updated?.name).toBe("Updated name");
    expect(updated?.imageUrl).toBe(
      "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/x.jpg",
    );
  });

  it("a concurrent-style interleaving — setBundleImage() between read and updateBundleFields() — is never clobbered when imageUrl is omitted", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(
        campaign.id,
        bundleInput({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/old.jpg",
        }),
        tx,
      );

      // Simulates another request's concurrent image removal landing
      // BETWEEN this request reading the bundle and writing its own
      // (unrelated field) update.
      await setBundleImage(bundle!.id, campaign.id, null, tx);

      const { imageUrl: _imageUrl, ...withoutImageUrl } = bundleInput({
        name: "Renamed concurrently",
        slug: bundle!.slug,
      });
      void _imageUrl;
      return updateBundleFields(bundle!.id, withoutImageUrl, tx);
    });

    // The concurrent removal survives — this write never touched the
    // column at all, so there was nothing to clobber it with.
    expect(updated?.imageUrl).toBeNull();
    expect(updated?.name).toBe("Renamed concurrently");
  });
});

describe("setBundleImage (Phase 15, Gate ARCH-006-E)", () => {
  it("sets imageUrl on the correct bundle, by id, and leaves every other column untouched", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const other = await createBundle(
        campaign.id,
        bundleInput({ name: `Other-${unique("x")}` }),
        tx,
      );
      const target = await createBundle(
        campaign.id,
        bundleInput({ name: `Target-${unique("x")}`, priceAmount: 5_000 }),
        tx,
      );

      const updated = await setBundleImage(
        target!.id,
        campaign.id,
        "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/x.jpg",
        tx,
      );

      expect(updated.id).toBe(target!.id);
      expect(updated.imageUrl).toBe(
        "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/x.jpg",
      );
      // No unintended column updates — every other field is exactly
      // what createBundle wrote, untouched by this call.
      expect(updated.name).toBe(target!.name);
      expect(updated.priceAmount).toBe(5_000);
      expect(updated.active).toBe(target!.active);
      expect(updated.slug).toBe(target!.slug);

      // Correct ID filtering, checked within the SAME transaction (the
      // other bundle still exists here — a separate withRollback call
      // would have already discarded it, proving nothing): the OTHER
      // bundle was never touched.
      const unchangedOther = await getBundle(other!.id, tx);
      expect(unchangedOther?.imageUrl).toBeNull();
    });
  });

  it("nulls imageUrl (the removal path) without affecting other columns", async () => {
    const updated = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(
        campaign.id,
        bundleInput({
          imageUrl: "https://du7clicrjnwnwcsd.public.blob.vercel-storage.com/bundles/x.jpg",
        }),
        tx,
      );
      return setBundleImage(bundle!.id, campaign.id, null, tx);
    });

    expect(updated.imageUrl).toBeNull();
  });

  it("is idempotent — nulling an already-null imageUrl succeeds trivially", async () => {
    const { first, second } = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(campaign.id, bundleInput({ imageUrl: null }), tx);
      const first = await setBundleImage(bundle!.id, campaign.id, null, tx);
      const second = await setBundleImage(bundle!.id, campaign.id, null, tx);
      return { first, second };
    });

    expect(first.imageUrl).toBeNull();
    expect(second.imageUrl).toBeNull();
  });

  it("throws BundleNotFoundError for a nonexistent id", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      await expect(setBundleImage(randomUUID(), campaign.id, null, tx)).rejects.toThrow(
        BundleNotFoundError,
      );
    });
  });

  it("throws BundleNotFoundError (never leaking that the bundle exists) when the campaign does not match", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const { campaign: otherCampaign } = await createBaseFixtures(tx);
      const bundle = await createBundle(campaign.id, bundleInput(), tx);

      await expect(
        setBundleImage(bundle!.id, otherCampaign.id, "https://evil.example.com/x.jpg", tx),
      ).rejects.toThrow(BundleNotFoundError);

      // The mismatched call must not have written anything either.
      const unchanged = await getBundle(bundle!.id, tx);
      expect(unchanged?.imageUrl).toBeNull();
    });
  });
});

describe("listCampaignBundles / getBundle", () => {
  it("lists a campaign's bundles ordered by displayOrder", async () => {
    const names = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      await createBundle(campaign.id, bundleInput({ name: "First" }), tx);
      await createBundle(campaign.id, bundleInput({ name: "Second" }), tx);
      const rows = await listCampaignBundles(campaign.id, tx);
      return rows.map((r) => r.name);
    });
    expect(names).toEqual(["First", "Second"]);
  });

  it("getBundle returns null for an unknown id", async () => {
    const result = await withRollback((tx) => getBundle(randomUUID(), tx));
    expect(result).toBeNull();
  });
});

describe("replaceBundleComposition", () => {
  it("replaces composition transactionally", async () => {
    const items = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      const second = await extraProduct(tx, "Second");
      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      await attachProductToCampaign(campaign.id, second.id, 1_000, tx);
      const bundle = await createBundle(campaign.id, bundleInput(), tx);

      await replaceBundleComposition(
        bundle!.id,
        campaign.id,
        [
          { productId: product.id, quantity: 2 },
          { productId: second.id, quantity: 1 },
        ],
        tx,
      );
      return getBundleItems(bundle!.id, tx);
    });
    expect(items).toHaveLength(2);
  });

  it("replacing with an empty list clears the composition", async () => {
    const items = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      const bundle = await createBundle(campaign.id, bundleInput(), tx);
      await replaceBundleComposition(
        bundle!.id,
        campaign.id,
        [{ productId: product.id, quantity: 1 }],
        tx,
      );
      await replaceBundleComposition(bundle!.id, campaign.id, [], tx);
      return getBundleItems(bundle!.id, tx);
    });
    expect(items).toHaveLength(0);
  });

  it("rejects a duplicate component and leaves the previous composition intact", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign, product } = await createBaseFixtures(tx);
        await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
        const bundle = await createBundle(campaign.id, bundleInput(), tx);
        await replaceBundleComposition(
          bundle!.id,
          campaign.id,
          [{ productId: product.id, quantity: 1 }],
          tx,
        );

        await replaceBundleComposition(
          bundle!.id,
          campaign.id,
          [
            { productId: product.id, quantity: 1 },
            { productId: product.id, quantity: 2 },
          ],
          tx,
        );
      }),
    ).rejects.toBeInstanceOf(DuplicateBundleComponentError);
  });

  it("preserves the previous composition when the replacement is rejected", async () => {
    const items = await withRollback(async (tx) => {
      const { campaign, product } = await createBaseFixtures(tx);
      await attachProductToCampaign(campaign.id, product.id, 1_000, tx);
      const bundle = await createBundle(campaign.id, bundleInput(), tx);
      await replaceBundleComposition(
        bundle!.id,
        campaign.id,
        [{ productId: product.id, quantity: 1 }],
        tx,
      );

      // A nested transaction (SAVEPOINT) so only this rejected call
      // rolls back — the outer withRollback transaction, and the valid
      // composition written just above, are unaffected.
      await tx
        .transaction(async (nested) =>
          replaceBundleComposition(
            bundle!.id,
            campaign.id,
            [
              { productId: product.id, quantity: 1 },
              { productId: product.id, quantity: 2 },
            ],
            nested,
          ),
        )
        .catch(() => undefined);

      return getBundleItems(bundle!.id, tx);
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.item.quantity).toBe(1);
  });

  it("rejects a component that belongs to a different campaign", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        const { campaign: otherCampaign, product: otherProduct } = await createBaseFixtures(tx);
        await attachProductToCampaign(otherCampaign.id, otherProduct.id, 1_000, tx);
        const bundle = await createBundle(campaign.id, bundleInput(), tx);

        return replaceBundleComposition(
          bundle!.id,
          campaign.id,
          [{ productId: otherProduct.id, quantity: 1 }],
          tx,
        );
      }),
    ).rejects.toBeInstanceOf(InvalidBundleComponentError);
  });

  it("throws BundleNotFoundError for an unknown bundle or a bundle from a different campaign", async () => {
    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        return replaceBundleComposition(randomUUID(), campaign.id, [], tx);
      }),
    ).rejects.toBeInstanceOf(BundleNotFoundError);

    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        const { campaign: otherCampaign } = await createBaseFixtures(tx);
        const bundle = await createBundle(campaign.id, bundleInput(), tx);
        return replaceBundleComposition(bundle!.id, otherCampaign.id, [], tx);
      }),
    ).rejects.toBeInstanceOf(BundleNotFoundError);
  });
});
