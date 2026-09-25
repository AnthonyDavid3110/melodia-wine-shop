import { describe, expect, it } from "vitest";
import { getCampaignDashboardOrders } from "@/infrastructure/dashboard/dashboard";
import { payments } from "../schema";
import { createBaseFixtures, createOrder } from "./fixtures";
import { withRollback } from "./setup";

describe("getCampaignDashboardOrders", () => {
  it("scopes strictly to the requested campaign", async () => {
    await withRollback(async (tx) => {
      const { campaign: campaignA } = await createBaseFixtures(tx);
      const { campaign: campaignB } = await createBaseFixtures(tx);
      const orderA = await createOrder(tx, campaignA.id);
      await createOrder(tx, campaignB.id);

      const rows = await getCampaignDashboardOrders(campaignA.id, tx);
      expect(rows.map((row) => row.order.id)).toEqual([orderA.id]);
    });
  });

  it("includes CANCELLED orders (exclusion is the caller's responsibility)", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const cancelled = await createOrder(tx, campaign.id, { status: "CANCELLED" });

      const rows = await getCampaignDashboardOrders(campaign.id, tx);
      expect(rows.map((row) => row.order.id)).toContain(cancelled.id);
    });
  });

  it("left-joins the seller so unassigned orders still appear", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id, { sellerId: null });

      const rows = await getCampaignDashboardOrders(campaign.id, tx);
      const row = rows.find((candidate) => candidate.order.id === order.id);
      expect(row).toBeDefined();
      expect(row!.seller).toBeNull();
    });
  });

  it("batches every payment row per order without a per-order query", async () => {
    await withRollback(async (tx) => {
      const { campaign } = await createBaseFixtures(tx);
      const order = await createOrder(tx, campaign.id, { totalAmount: 5_000 });
      await tx.insert(payments).values([
        {
          orderId: order.id,
          method: "TWINT",
          provider: "SAFERPAY",
          amount: 5_000,
          status: "FAILED",
        },
        {
          orderId: order.id,
          method: "TWINT",
          provider: "SAFERPAY",
          amount: 5_000,
          status: "SUCCEEDED",
        },
      ]);

      const rows = await getCampaignDashboardOrders(campaign.id, tx);
      const row = rows.find((candidate) => candidate.order.id === order.id);
      expect(row!.payments).toHaveLength(2);
    });
  });
});
