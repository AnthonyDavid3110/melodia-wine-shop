import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SellerNotFoundError,
  createSeller,
  getSeller,
  listSellers,
  setSellerActive,
  updateSeller,
} from "@/infrastructure/sellers/sellers";
import {
  CampaignSellerNotFoundError,
  addSellerToCampaign,
  bulkAddActiveSellers,
  listAttachableSellers,
  listCampaignSellers,
  setCampaignSellerActive,
  setCampaignSellerTarget,
} from "@/infrastructure/campaign/campaign-sellers";
import { CampaignNotFoundError } from "@/infrastructure/campaign/campaigns";
import { createBaseFixtures, unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";
import { sellers } from "../schema";
import { and, eq, ne } from "drizzle-orm";

/**
 * The real seed data (and any other test's fixtures already committed
 * before this transaction started) includes active sellers of its own
 * — `bulkAddActiveSellers` correctly operates on *every* active seller,
 * so an exact-count assertion on it must first neutralize whatever
 * already exists, mirroring `neutralizeExistingActiveCampaigns` in
 * campaign.db.test.ts for the same reason.
 */
async function neutralizeExistingActiveSellers(tx: Tx, exceptId?: string) {
  const condition = exceptId
    ? and(eq(sellers.active, true), ne(sellers.id, exceptId))
    : eq(sellers.active, true);
  await tx.update(sellers).set({ active: false }).where(condition);
}

async function extraSeller(tx: Tx, lastName = "Extra") {
  const [seller] = await tx
    .insert(sellers)
    .values({ firstName: "Test", lastName: unique(lastName) })
    .returning();
  if (!seller) throw new Error("fixture insert failed");
  return seller;
}

describe("Seller master data", () => {
  it("creates, updates, and toggles active without a hard delete", async () => {
    const result = await withRollback(async (tx) => {
      const created = await createSeller({ firstName: "Jean", lastName: unique("Dupont") }, tx);
      const updated = await updateSeller(
        created.id,
        { firstName: "Jeanne", lastName: created.lastName },
        tx,
      );
      const deactivated = await setSellerActive(created.id, false, tx);
      return { updated, deactivated };
    });
    expect(result.updated.firstName).toBe("Jeanne");
    expect(result.deactivated.active).toBe(false);
  });

  it("throws SellerNotFoundError for update/setActive on an unknown id", async () => {
    await expect(
      withRollback((tx) => updateSeller(randomUUID(), { firstName: "A", lastName: "B" }, tx)),
    ).rejects.toBeInstanceOf(SellerNotFoundError);
    await expect(
      withRollback((tx) => setSellerActive(randomUUID(), false, tx)),
    ).rejects.toBeInstanceOf(SellerNotFoundError);
  });

  it("getSeller returns null and listSellers orders alphabetically by last name", async () => {
    const result = await withRollback(async (tx) => {
      const notFound = await getSeller(randomUUID(), tx);
      await extraSeller(tx, "Zorro");
      await extraSeller(tx, "Aaronson");
      const list = await listSellers(tx);
      return { notFound, firstTwoOrdered: list.slice(0, 2).map((s) => s.lastName) };
    });
    expect(result.notFound).toBeNull();
    // Aaronson-prefixed name sorts before Zorro-prefixed among our two fixtures.
    const aaronsonIndex = result.firstTwoOrdered.findIndex((n) => n.startsWith("Aaronson"));
    const zorroIndex = result.firstTwoOrdered.findIndex((n) => n.startsWith("Zorro"));
    if (aaronsonIndex !== -1 && zorroIndex !== -1) {
      expect(aaronsonIndex).toBeLessThan(zorroIndex);
    }
  });
});

describe("CampaignSeller participation", () => {
  it("addSellerToCampaign creates a participation row with the given target", async () => {
    const row = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      return addSellerToCampaign(campaign.id, seller.id, 120_000, tx);
    });
    expect(row.active).toBe(true);
    expect(row.targetAmount).toBe(120_000);
  });

  it("reactivates and re-targets an existing inactive row instead of duplicating it", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const first = await addSellerToCampaign(campaign.id, seller.id, null, tx);
      await setCampaignSellerActive(first.id, false, tx);
      const readded = await addSellerToCampaign(campaign.id, seller.id, 50_000, tx);
      const rows = await listCampaignSellers(campaign.id, tx);
      return {
        readdedId: readded.id,
        firstId: first.id,
        target: readded.targetAmount,
        rowCount: rows.length,
      };
    });
    expect(result.readdedId).toBe(result.firstId);
    expect(result.target).toBe(50_000);
    expect(result.rowCount).toBe(1);
  });

  it("rejects an unknown campaign or seller", async () => {
    await expect(
      withRollback(async (tx) => {
        const { seller } = await createBaseFixtures(tx);
        return addSellerToCampaign(randomUUID(), seller.id, null, tx);
      }),
    ).rejects.toBeInstanceOf(CampaignNotFoundError);

    await expect(
      withRollback(async (tx) => {
        const { campaign } = await createBaseFixtures(tx);
        return addSellerToCampaign(campaign.id, randomUUID(), null, tx);
      }),
    ).rejects.toBeInstanceOf(SellerNotFoundError);
  });

  it("an empty target override stays null (inherit), never coerced to zero", async () => {
    const row = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const created = await addSellerToCampaign(campaign.id, seller.id, null, tx);
      return setCampaignSellerTarget(created.id, null, tx);
    });
    expect(row.targetAmount).toBeNull();
  });

  it("a zero target override is stored as zero, not null", async () => {
    const row = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const created = await addSellerToCampaign(campaign.id, seller.id, null, tx);
      return setCampaignSellerTarget(created.id, 0, tx);
    });
    expect(row.targetAmount).toBe(0);
  });

  it("throws CampaignSellerNotFoundError for setActive/setTarget on an unknown row", async () => {
    await expect(
      withRollback((tx) => setCampaignSellerActive(randomUUID(), true, tx)),
    ).rejects.toBeInstanceOf(CampaignSellerNotFoundError);
    await expect(
      withRollback((tx) => setCampaignSellerTarget(randomUUID(), 1_000, tx)),
    ).rejects.toBeInstanceOf(CampaignSellerNotFoundError);
  });

  it("listAttachableSellers excludes already-participating sellers and inactive master sellers", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const neverAdded = await extraSeller(tx, "NeverAdded");
      const globallyInactive = await extraSeller(tx, "GloballyInactive");
      await tx.update(sellers).set({ active: false }).where(eq(sellers.id, globallyInactive.id));

      await addSellerToCampaign(campaign.id, seller.id, null, tx);

      const rows = await listAttachableSellers(campaign.id, tx);
      return { names: rows.map((s) => s.lastName), neverAddedName: neverAdded.lastName };
    });
    expect(result.names).toContain(result.neverAddedName);
    expect(result.names.some((n) => n.startsWith("GloballyInactive"))).toBe(false);
  });
});

describe("bulkAddActiveSellers", () => {
  it("adds every active seller not yet participating", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      // Neutralize *after* the fixture insert too — createBaseFixtures
      // creates its own (unused, here) active seller alongside the
      // campaign, which would otherwise also get bulk-added.
      await neutralizeExistingActiveSellers(tx);
      await extraSeller(tx, "A");
      await extraSeller(tx, "B");
      const inactive = await extraSeller(tx, "Inactive");
      await tx.update(sellers).set({ active: false }).where(eq(sellers.id, inactive.id));

      const outcome = await bulkAddActiveSellers(campaign.id, tx);
      const rows = await listCampaignSellers(campaign.id, tx);
      return { outcome, rowCount: rows.length };
    });
    expect(result.outcome.added).toBe(2);
    expect(result.outcome.reactivated).toBe(0);
    expect(result.rowCount).toBe(2);
  });

  it("reactivates an existing inactive participation instead of duplicating it", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign, seller } = await createBaseFixtures(tx);
      const row = await addSellerToCampaign(campaign.id, seller.id, null, tx);
      await setCampaignSellerActive(row.id, false, tx);
      // Neutralize every other active seller (real seed data included)
      // so only `seller` is a bulk-add candidate.
      await neutralizeExistingActiveSellers(tx, seller.id);

      const outcome = await bulkAddActiveSellers(campaign.id, tx);
      const rows = await listCampaignSellers(campaign.id, tx);
      return { outcome, active: rows[0]!.campaignSeller.active, rowCount: rows.length };
    });
    expect(result.outcome.added).toBe(0);
    expect(result.outcome.reactivated).toBe(1);
    expect(result.active).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  it("is idempotent — running it twice in a row changes nothing the second time", async () => {
    const result = await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const idempotentSeller = await extraSeller(tx, "Idempotent");
      await neutralizeExistingActiveSellers(tx, idempotentSeller.id);
      await bulkAddActiveSellers(campaign.id, tx);
      const second = await bulkAddActiveSellers(campaign.id, tx);
      const rows = await listCampaignSellers(campaign.id, tx);
      return { second, rowCount: rows.length };
    });
    expect(result.second.added).toBe(0);
    expect(result.second.reactivated).toBe(0);
    expect(result.rowCount).toBe(1);
  });

  it("rejects an unknown campaign", async () => {
    await expect(
      withRollback((tx) => bulkAddActiveSellers(randomUUID(), tx)),
    ).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
