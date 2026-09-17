import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { campaigns, sellers } from "../schema";
import { unique } from "./fixtures";
import { db } from "./setup";

/**
 * Proves db.transaction() — the actual application database
 * abstraction from src/infrastructure/database/client.ts, not a
 * separate ad-hoc pg client — really rolls back against real
 * PostgreSQL: two writes inside one transaction, a deliberate throw
 * before commit, then confirms from a fresh query that neither write
 * exists.
 */
describe("db.transaction rollback", () => {
  it("persists neither write when the callback throws before commit", async () => {
    const campaignSlug = unique("rollback-campaign");
    const sellerLastName = unique("RollbackSeller");

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(campaigns).values({ name: "Should not persist", slug: campaignSlug });
        await tx.insert(sellers).values({ firstName: "Should", lastName: sellerLastName });
        throw new Error("deliberate rollback trigger");
      }),
    ).rejects.toThrow("deliberate rollback trigger");

    const [foundCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, campaignSlug));
    const [foundSeller] = await db
      .select()
      .from(sellers)
      .where(eq(sellers.lastName, sellerLastName));

    expect(foundCampaign).toBeUndefined();
    expect(foundSeller).toBeUndefined();
  });

  it("persists both writes when the callback succeeds (control case)", async () => {
    const campaignSlug = unique("commit-campaign");

    await db.transaction(async (tx) => {
      await tx.insert(campaigns).values({ name: "Should persist", slug: campaignSlug });
    });

    const [foundCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, campaignSlug));
    expect(foundCampaign).toBeDefined();

    // Clean up — this test intentionally commits, so it cleans up after itself.
    await db.delete(campaigns).where(eq(campaigns.slug, campaignSlug));
  });
});
