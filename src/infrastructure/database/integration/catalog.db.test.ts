import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { MultipleActiveCampaignsError } from "@/domain/catalog/resolve-active-campaign";
import { bundleItems, campaignProducts, campaigns, products } from "../schema";
import { createBundle, createCampaignProduct, unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

/**
 * getPublicCatalog() reads through the shared `db` singleton by
 * default, so — unlike most of this suite — these tests must pass the
 * `withRollback` transaction into it explicitly
 * (`getPublicCatalog(tx)`) for fixture rows to be visible to it at all
 * (a separate, uncommitted transaction is otherwise invisible to any
 * other connection). Every test also has to temporarily neutralize any
 * pre-existing ACTIVE campaign (the dev seed's own campaign) within the
 * same rolled-back transaction before inserting its own — the new
 * `campaigns_one_active_idx` partial unique index (drizzle/0002) is
 * checked against the whole table, seed row included, not just this
 * transaction's own inserts.
 */
async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

describe("getPublicCatalog — active campaign resolution", () => {
  it("returns no-active-campaign when zero campaigns are ACTIVE", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const result = await getPublicCatalog(tx);
      expect(result).toEqual({ state: "no-active-campaign" });
    });
  });

  it("returns the active campaign's wines and bundles for exactly one ACTIVE campaign", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const [campaign] = await tx
        .insert(campaigns)
        .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
        .returning();
      if (!campaign) throw new Error("fixture insert failed");

      const [product] = await tx
        .insert(products)
        .values({ slug: unique("wine"), name: "Chasselas de test", category: "WHITE" })
        .returning();
      if (!product) throw new Error("fixture insert failed");

      await createCampaignProduct(tx, campaign.id, product.id);

      const result = await getPublicCatalog(tx);
      expect(result.state).toBe("active");
      if (result.state !== "active") throw new Error("expected active state");
      expect(result.campaign.id).toBe(campaign.id);
      expect(result.wines).toHaveLength(1);
      expect(result.wines[0]?.name).toBe("Chasselas de test");
      expect(result.wines[0]?.price).toBe(1800);
    });
  });

  it("treats an impossible multiple-ACTIVE read as an invariant violation, never silently picking one", async () => {
    // The database itself now prevents this from ever being written
    // (campaigns_one_active_idx) — this test exercises the defensive
    // read-side handling directly against fabricated rows, proving the
    // application layer would refuse to silently resolve such a state
    // if it were ever encountered.
    const { resolveActiveCampaign } = await import("@/domain/catalog/resolve-active-campaign");
    expect(() =>
      resolveActiveCampaign([
        { id: "a", status: "ACTIVE" },
        { id: "b", status: "ACTIVE" },
      ]),
    ).toThrow(MultipleActiveCampaignsError);
  });
});

describe("getPublicCatalog — campaign isolation", () => {
  it("does not leak products from a different (non-active) campaign", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const [activeCampaign] = await tx
        .insert(campaigns)
        .values({
          name: unique("Active Campaign"),
          slug: unique("active-campaign"),
          status: "ACTIVE",
        })
        .returning();
      const [otherCampaign] = await tx
        .insert(campaigns)
        .values({
          name: unique("Other Campaign"),
          slug: unique("other-campaign"),
          status: "CLOSED",
        })
        .returning();
      if (!activeCampaign || !otherCampaign) throw new Error("fixture insert failed");

      const [activeProduct] = await tx
        .insert(products)
        .values({ slug: unique("active-wine"), name: "Active Wine", category: "WHITE" })
        .returning();
      const [otherProduct] = await tx
        .insert(products)
        .values({ slug: unique("other-wine"), name: "Other Campaign Wine", category: "RED" })
        .returning();
      if (!activeProduct || !otherProduct) throw new Error("fixture insert failed");

      await createCampaignProduct(tx, activeCampaign.id, activeProduct.id);
      await createCampaignProduct(tx, otherCampaign.id, otherProduct.id);

      const result = await getPublicCatalog(tx);
      if (result.state !== "active") throw new Error("expected active state");
      expect(result.wines.map((w) => w.name)).toEqual(["Active Wine"]);
    });
  });

  it("does not leak an inactive CampaignProduct within the active campaign itself", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const [campaign] = await tx
        .insert(campaigns)
        .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
        .returning();
      if (!campaign) throw new Error("fixture insert failed");

      const [visible] = await tx
        .insert(products)
        .values({ slug: unique("visible"), name: "Visible Wine", category: "WHITE" })
        .returning();
      const [hidden] = await tx
        .insert(products)
        .values({ slug: unique("hidden"), name: "Hidden Wine", category: "RED" })
        .returning();
      if (!visible || !hidden) throw new Error("fixture insert failed");

      await createCampaignProduct(tx, campaign.id, visible.id);
      const [hiddenCp] = await tx
        .insert(campaignProducts)
        .values({
          campaignId: campaign.id,
          productId: hidden.id,
          unitPriceAmount: 1800,
          active: false,
        })
        .returning();
      if (!hiddenCp) throw new Error("fixture insert failed");

      const result = await getPublicCatalog(tx);
      if (result.state !== "active") throw new Error("expected active state");
      expect(result.wines.map((w) => w.name)).toEqual(["Visible Wine"]);
    });
  });
});

describe("getPublicCatalog — bundles", () => {
  it("loads a valid bundle's composition from the database, ordered by CampaignProduct.displayOrder", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const [campaign] = await tx
        .insert(campaigns)
        .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
        .returning();
      if (!campaign) throw new Error("fixture insert failed");

      const [productA] = await tx
        .insert(products)
        .values({ slug: unique("wine-a"), name: "Wine A", category: "WHITE" })
        .returning();
      const [productB] = await tx
        .insert(products)
        .values({ slug: unique("wine-b"), name: "Wine B", category: "RED" })
        .returning();
      if (!productA || !productB) throw new Error("fixture insert failed");

      // Insert B's CampaignProduct first (displayOrder default 0) then
      // give A displayOrder 1 — composition must still resolve to B, A.
      await tx.insert(campaignProducts).values({
        campaignId: campaign.id,
        productId: productB.id,
        unitPriceAmount: 2000,
        displayOrder: 0,
      });
      await tx.insert(campaignProducts).values({
        campaignId: campaign.id,
        productId: productA.id,
        unitPriceAmount: 1800,
        displayOrder: 1,
      });

      const bundle = await createBundle(tx, campaign.id);
      await tx.insert(bundleItems).values([
        { bundleId: bundle.id, productId: productA.id, quantity: 1 },
        { bundleId: bundle.id, productId: productB.id, quantity: 2 },
      ]);

      const result = await getPublicCatalog(tx);
      if (result.state !== "active") throw new Error("expected active state");
      expect(result.bundles).toHaveLength(1);
      expect(result.bundles[0]?.items.map((i) => i.name)).toEqual(["Wine B", "Wine A"]);
      expect(result.bundles[0]?.bottleCount).toBe(3);
    });
  });

  it("excludes the whole bundle when a component references a product outside the active campaign", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);

      const [campaign] = await tx
        .insert(campaigns)
        .values({ name: unique("Campaign"), slug: unique("campaign"), status: "ACTIVE" })
        .returning();
      if (!campaign) throw new Error("fixture insert failed");

      const [inCampaign] = await tx
        .insert(products)
        .values({ slug: unique("in-campaign"), name: "In Campaign", category: "WHITE" })
        .returning();
      const [outOfCampaign] = await tx
        .insert(products)
        .values({ slug: unique("out-of-campaign"), name: "Out Of Campaign", category: "RED" })
        .returning();
      if (!inCampaign || !outOfCampaign) throw new Error("fixture insert failed");

      await createCampaignProduct(tx, campaign.id, inCampaign.id);
      // outOfCampaign deliberately has no CampaignProduct row in this campaign at all.

      const bundle = await createBundle(tx, campaign.id);
      await tx.insert(bundleItems).values([
        { bundleId: bundle.id, productId: inCampaign.id, quantity: 1 },
        { bundleId: bundle.id, productId: outOfCampaign.id, quantity: 1 },
      ]);

      const result = await getPublicCatalog(tx);
      if (result.state !== "active") throw new Error("expected active state");
      expect(result.bundles).toHaveLength(0);
    });
  });
});

describe("campaigns_one_active_idx — database invariant", () => {
  it("allows zero ACTIVE campaigns", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const activeRows = await tx.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
      expect(activeRows).toHaveLength(0);
    });
  });

  it("allows exactly one ACTIVE campaign", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      await tx
        .insert(campaigns)
        .values({ name: unique("Solo Active"), slug: unique("solo-active"), status: "ACTIVE" });
      const activeRows = await tx.select().from(campaigns).where(eq(campaigns.status, "ACTIVE"));
      expect(activeRows).toHaveLength(1);
    });
  });

  it("rejects a second ACTIVE campaign at the database level", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      await tx
        .insert(campaigns)
        .values({ name: unique("First Active"), slug: unique("first-active"), status: "ACTIVE" });

      let caught: unknown;
      try {
        await tx.transaction(async (tx2) => {
          await tx2.insert(campaigns).values({
            name: unique("Second Active"),
            slug: unique("second-active"),
            status: "ACTIVE",
          });
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      // Drizzle wraps the real Postgres error in `cause` — the
      // constraint name lives there, not in the top-level message.
      expect(String((caught as Error).cause)).toContain("campaigns_one_active_idx");
    });
  });

  it("rejects updating a second campaign to ACTIVE while one is already active", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      await tx.insert(campaigns).values({
        name: unique("Already Active"),
        slug: unique("already-active"),
        status: "ACTIVE",
      });
      const [draft] = await tx
        .insert(campaigns)
        .values({ name: unique("Still Draft"), slug: unique("still-draft"), status: "DRAFT" })
        .returning();
      if (!draft) throw new Error("fixture insert failed");

      let caught: unknown;
      try {
        await tx.transaction(async (tx2) => {
          await tx2.update(campaigns).set({ status: "ACTIVE" }).where(eq(campaigns.id, draft.id));
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(String((caught as Error).cause)).toContain("campaigns_one_active_idx");
    });
  });
});
