import { describe, expect, it } from "vitest";
import {
  campaignEventTypeForTransition,
  isValidCampaignTransition,
  type CampaignStatus,
} from "./campaign-status";

const ALL_STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];

describe("isValidCampaignTransition", () => {
  const valid: [CampaignStatus, CampaignStatus][] = [
    ["DRAFT", "ACTIVE"],
    ["DRAFT", "ARCHIVED"],
    ["ACTIVE", "CLOSED"],
    ["CLOSED", "ACTIVE"],
    ["CLOSED", "ARCHIVED"],
  ];

  it.each(valid)("allows %s -> %s", (from, to) => {
    expect(isValidCampaignTransition(from, to)).toBe(true);
  });

  it("rejects every transition out of ARCHIVED (terminal state)", () => {
    for (const to of ALL_STATUSES) {
      expect(isValidCampaignTransition("ARCHIVED", to)).toBe(false);
    }
  });

  it("rejects DRAFT -> CLOSED (sales were never open)", () => {
    expect(isValidCampaignTransition("DRAFT", "CLOSED")).toBe(false);
  });

  it("rejects ACTIVE -> ARCHIVED directly (must close first)", () => {
    expect(isValidCampaignTransition("ACTIVE", "ARCHIVED")).toBe(false);
  });

  it("rejects ACTIVE -> DRAFT", () => {
    expect(isValidCampaignTransition("ACTIVE", "DRAFT")).toBe(false);
  });

  it("rejects a same-status no-op transition", () => {
    for (const status of ALL_STATUSES) {
      expect(isValidCampaignTransition(status, status)).toBe(false);
    }
  });
});

describe("campaignEventTypeForTransition", () => {
  it("classifies DRAFT -> ACTIVE as ACTIVATED", () => {
    expect(campaignEventTypeForTransition("DRAFT", "ACTIVE")).toBe("ACTIVATED");
  });

  it("classifies CLOSED -> ACTIVE as REOPENED, not ACTIVATED", () => {
    expect(campaignEventTypeForTransition("CLOSED", "ACTIVE")).toBe("REOPENED");
  });

  it("classifies ACTIVE -> CLOSED as CLOSED", () => {
    expect(campaignEventTypeForTransition("ACTIVE", "CLOSED")).toBe("CLOSED");
  });

  it("classifies DRAFT -> ARCHIVED as ARCHIVED", () => {
    expect(campaignEventTypeForTransition("DRAFT", "ARCHIVED")).toBe("ARCHIVED");
  });

  it("classifies CLOSED -> ARCHIVED as ARCHIVED", () => {
    expect(campaignEventTypeForTransition("CLOSED", "ARCHIVED")).toBe("ARCHIVED");
  });

  it("throws for an invalid transition rather than guessing", () => {
    expect(() => campaignEventTypeForTransition("ARCHIVED", "ACTIVE")).toThrow(/Invalid/);
  });
});
