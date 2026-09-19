import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  AnotherCampaignAlreadyActiveError,
  CampaignNotFoundError,
  DuplicateCampaignSlugError,
  InvalidCampaignTransitionError,
  campaignSlugExists,
  createCampaign,
  listCampaignEvents,
  transitionCampaignStatus,
  updateCampaignFields,
} from "@/infrastructure/campaign/campaigns";
import { getCampaignReadinessFacts } from "@/infrastructure/campaign/campaign-readiness";
import { adminUsers, campaigns } from "../schema";
import { unique } from "./fixtures";
import { withRollback, type Tx } from "./setup";

async function neutralizeExistingActiveCampaigns(tx: Tx) {
  await tx.update(campaigns).set({ status: "DRAFT" }).where(eq(campaigns.status, "ACTIVE"));
}

function fields(overrides: Partial<Parameters<typeof createCampaign>[0]> = {}) {
  return {
    name: unique("Campaign"),
    slug: unique("campaign"),
    publicTitle: null,
    description: null,
    openingDate: null,
    closingDate: null,
    defaultSellerTargetAmount: null,
    ...overrides,
  };
}

async function createTestAdmin(tx: Tx) {
  const [admin] = await tx
    .insert(adminUsers)
    .values({ email: `${unique("admin")}@example.test`, name: "Test Admin" })
    .returning();
  if (!admin) throw new Error("fixture insert failed");
  return admin;
}

describe("createCampaign", () => {
  it("creates a new campaign, always starting DRAFT regardless of input", async () => {
    await withRollback(async (tx) => {
      const campaign = await createCampaign(fields({ name: "Vente Test" }), tx);
      expect(campaign?.status).toBe("DRAFT");
      expect(campaign?.name).toBe("Vente Test");
    });
  });

  it("rejects a duplicate slug with a friendly error", async () => {
    await withRollback(async (tx) => {
      const slug = unique("dup-slug");
      await createCampaign(fields({ slug }), tx);
      await expect(
        tx.transaction(async (tx2) => createCampaign(fields({ slug }), tx2)),
      ).rejects.toThrow(DuplicateCampaignSlugError);
    });
  });
});

describe("campaignSlugExists", () => {
  it("reports false for a free slug and true for a taken one (backs Gate 2C automatic slug generation)", async () => {
    await withRollback(async (tx) => {
      const slug = unique("free-slug");
      expect(await campaignSlugExists(slug, tx)).toBe(false);
      await createCampaign(fields({ slug }), tx);
      expect(await campaignSlugExists(slug, tx)).toBe(true);
    });
  });
});

describe("updateCampaignFields", () => {
  it("updates editable fields without touching status", async () => {
    await withRollback(async (tx) => {
      const campaign = await createCampaign(fields({ name: "Original" }), tx);
      const updated = await updateCampaignFields(
        campaign!.id,
        fields({ name: "Updated", slug: campaign!.slug, publicTitle: "Titre public" }),
        tx,
      );
      expect(updated?.name).toBe("Updated");
      expect(updated?.publicTitle).toBe("Titre public");
      expect(updated?.status).toBe("DRAFT");
    });
  });

  it("throws CampaignNotFoundError for a nonexistent id", async () => {
    await withRollback(async (tx) => {
      await expect(
        updateCampaignFields("00000000-0000-0000-0000-000000000000", fields(), tx),
      ).rejects.toThrow(CampaignNotFoundError);
    });
  });
});

describe("transitionCampaignStatus", () => {
  it("activates a DRAFT campaign and records an ACTIVATED event", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);

      const activated = await transitionCampaignStatus(campaign!.id, "ACTIVE", admin.id, tx);
      expect(activated.status).toBe("ACTIVE");

      const events = await listCampaignEvents(campaign!.id, tx);
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("ACTIVATED");
      expect(events[0]?.adminUserId).toBe(admin.id);
    });
  });

  it("closes an ACTIVE campaign and records a CLOSED event", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);
      await transitionCampaignStatus(campaign!.id, "ACTIVE", admin.id, tx);

      const closed = await transitionCampaignStatus(campaign!.id, "CLOSED", admin.id, tx);
      expect(closed.status).toBe("CLOSED");

      // Not asserting strict order here: Postgres's `now()` is
      // transaction-start time, constant across the nested savepoints
      // `withRollback`/`transitionCampaignStatus` both use, so two
      // events recorded in quick succession inside one test's outer
      // transaction can share an identical `createdAt` — a
      // test-harness artifact, not a real-world concern (separate
      // Server Action invocations use separate transactions in
      // production). The set of recorded types is what matters here.
      const events = await listCampaignEvents(campaign!.id, tx);
      expect(events.map((e) => e.type).sort()).toEqual(["ACTIVATED", "CLOSED"].sort());
      expect(events).toHaveLength(2);
    });
  });

  it("reopens a CLOSED campaign and records REOPENED, not ACTIVATED", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);
      await transitionCampaignStatus(campaign!.id, "ACTIVE", admin.id, tx);
      await transitionCampaignStatus(campaign!.id, "CLOSED", admin.id, tx);

      const reopened = await transitionCampaignStatus(campaign!.id, "ACTIVE", admin.id, tx);
      expect(reopened.status).toBe("ACTIVE");

      // See the note in the "closes an ACTIVE campaign" test above —
      // order is not asserted for the same reason.
      const events = await listCampaignEvents(campaign!.id, tx);
      expect(events.map((e) => e.type).sort()).toEqual(["ACTIVATED", "CLOSED", "REOPENED"].sort());
      expect(events).toHaveLength(3);
    });
  });

  it("archives a DRAFT campaign directly (abandon-before-launch path)", async () => {
    await withRollback(async (tx) => {
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);

      const archived = await transitionCampaignStatus(campaign!.id, "ARCHIVED", admin.id, tx);
      expect(archived.status).toBe("ARCHIVED");

      const events = await listCampaignEvents(campaign!.id, tx);
      expect(events[0]?.type).toBe("ARCHIVED");
    });
  });

  it("rejects an invalid transition (e.g. DRAFT -> CLOSED) before touching the database", async () => {
    await withRollback(async (tx) => {
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);

      await expect(
        tx.transaction(async (tx2) =>
          transitionCampaignStatus(campaign!.id, "CLOSED", admin.id, tx2),
        ),
      ).rejects.toThrow(InvalidCampaignTransitionError);

      const [unchanged] = await tx.select().from(campaigns).where(eq(campaigns.id, campaign!.id));
      expect(unchanged?.status).toBe("DRAFT");
    });
  });

  it("rejects ARCHIVED -> anything (terminal state)", async () => {
    await withRollback(async (tx) => {
      const admin = await createTestAdmin(tx);
      const campaign = await createCampaign(fields(), tx);
      await transitionCampaignStatus(campaign!.id, "ARCHIVED", admin.id, tx);

      await expect(
        tx.transaction(async (tx2) =>
          transitionCampaignStatus(campaign!.id, "ACTIVE", admin.id, tx2),
        ),
      ).rejects.toThrow(InvalidCampaignTransitionError);
    });
  });

  it("rejects activating a second campaign while one is already ACTIVE, via the real mutation path", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const admin = await createTestAdmin(tx);
      const first = await createCampaign(fields({ name: "First" }), tx);
      const second = await createCampaign(fields({ name: "Second" }), tx);
      await transitionCampaignStatus(first!.id, "ACTIVE", admin.id, tx);

      await expect(
        tx.transaction(async (tx2) =>
          transitionCampaignStatus(second!.id, "ACTIVE", admin.id, tx2),
        ),
      ).rejects.toThrow(AnotherCampaignAlreadyActiveError);

      const [unchanged] = await tx.select().from(campaigns).where(eq(campaigns.id, second!.id));
      expect(unchanged?.status).toBe("DRAFT");
    });
  });
});

describe("getCampaignReadinessFacts", () => {
  it("detects another active campaign", async () => {
    await withRollback(async (tx) => {
      await neutralizeExistingActiveCampaigns(tx);
      const admin = await createTestAdmin(tx);
      const active = await createCampaign(fields({ name: "Active One" }), tx);
      await transitionCampaignStatus(active!.id, "ACTIVE", admin.id, tx);
      const draft = await createCampaign(fields({ name: "Draft One" }), tx);

      const facts = await getCampaignReadinessFacts(draft!, tx);
      expect(facts.anotherActiveCampaignExists).toBe(true);
    });
  });

  it("reports honest zeros for a freshly created campaign with nothing configured yet", async () => {
    await withRollback(async (tx) => {
      const campaign = await createCampaign(fields({ publicTitle: null }), tx);

      const facts = await getCampaignReadinessFacts(campaign!, tx);
      expect(facts.visibleProductCount).toBe(0);
      expect(facts.brokenActiveBundleCount).toBe(0);
      expect(facts.activeSellerCount).toBe(0);
      expect(facts.publicTitle).toBeNull();
      expect(facts.hasAnyDate).toBe(false);
    });
  });
});
