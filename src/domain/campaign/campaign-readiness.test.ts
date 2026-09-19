import { describe, expect, it } from "vitest";
import {
  checkCampaignReadiness,
  hasBlockingFindings,
  type CampaignReadinessFacts,
} from "./campaign-readiness";

function facts(overrides: Partial<CampaignReadinessFacts> = {}): CampaignReadinessFacts {
  return {
    anotherActiveCampaignExists: false,
    publicTitle: "Vente 2026",
    visibleProductCount: 6,
    zeroPricedVisibleProductCount: 0,
    brokenActiveBundleCount: 0,
    activeSellerCount: 5,
    hasAnyDate: true,
    ...overrides,
  };
}

describe("checkCampaignReadiness", () => {
  it("returns no findings for a fully-configured campaign", () => {
    expect(checkCampaignReadiness(facts())).toEqual([]);
  });

  it("flags another active campaign as BLOCKING", () => {
    const findings = checkCampaignReadiness(facts({ anotherActiveCampaignExists: true }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "blocking" }));
  });

  it("flags zero visible products as a WARNING, not a blocker", () => {
    const findings = checkCampaignReadiness(facts({ visibleProductCount: 0 }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "warning" }));
    expect(hasBlockingFindings(findings)).toBe(false);
  });

  it("flags zero-priced visible products as a WARNING, not a blocker (zero is technically valid)", () => {
    const findings = checkCampaignReadiness(facts({ zeroPricedVisibleProductCount: 2 }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "warning" }));
    expect(hasBlockingFindings(findings)).toBe(false);
  });

  it("flags a broken active bundle as a WARNING, not a blocker", () => {
    const findings = checkCampaignReadiness(facts({ brokenActiveBundleCount: 1 }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "warning" }));
    expect(hasBlockingFindings(findings)).toBe(false);
  });

  it("flags a missing public title as a WARNING (a real fallback exists)", () => {
    const findings = checkCampaignReadiness(facts({ publicTitle: null }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "warning" }));
  });

  it("flags zero sellers as INFORMATIONAL only", () => {
    const findings = checkCampaignReadiness(facts({ activeSellerCount: 0 }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "informational" }));
  });

  it("flags missing dates as INFORMATIONAL only", () => {
    const findings = checkCampaignReadiness(facts({ hasAnyDate: false }));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "informational" }));
  });

  it("never produces a blocking finding for anything except another active campaign", () => {
    const findings = checkCampaignReadiness(
      facts({
        visibleProductCount: 0,
        zeroPricedVisibleProductCount: 5,
        brokenActiveBundleCount: 3,
        publicTitle: null,
        activeSellerCount: 0,
        hasAnyDate: false,
      }),
    );
    expect(hasBlockingFindings(findings)).toBe(false);
  });
});

describe("hasBlockingFindings", () => {
  it("returns true only when a blocking finding is present", () => {
    expect(hasBlockingFindings([{ severity: "warning", message: "x" }])).toBe(false);
    expect(hasBlockingFindings([{ severity: "blocking", message: "x" }])).toBe(true);
    expect(hasBlockingFindings([])).toBe(false);
  });
});
