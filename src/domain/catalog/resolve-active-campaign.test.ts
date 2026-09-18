import { describe, expect, it } from "vitest";
import { MultipleActiveCampaignsError, resolveActiveCampaign } from "./resolve-active-campaign";

describe("resolveActiveCampaign", () => {
  it("returns null when there are zero active campaigns", () => {
    expect(resolveActiveCampaign([])).toBeNull();
  });

  it("returns the single active campaign", () => {
    const campaign = { id: "c1", name: "Vente 2026" };
    expect(resolveActiveCampaign([campaign])).toBe(campaign);
  });

  it("throws MultipleActiveCampaignsError for an impossible multi-active result rather than picking one", () => {
    const campaigns = [
      { id: "c1", name: "Vente 2026" },
      { id: "c2", name: "Vente 2027" },
    ];
    expect(() => resolveActiveCampaign(campaigns)).toThrow(MultipleActiveCampaignsError);
    expect(() => resolveActiveCampaign(campaigns)).toThrow(
      /expected at most one ACTIVE campaign, found 2/,
    );
  });

  it("throws for three or more active campaigns too", () => {
    expect(() => resolveActiveCampaign([{}, {}, {}])).toThrow(MultipleActiveCampaignsError);
  });
});
