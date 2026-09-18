import { describe, expect, it } from "vitest";
import { extractCampaignYear } from "./extract-campaign-year";

describe("extractCampaignYear", () => {
  it("extracts a year-like token from campaign text", () => {
    expect(extractCampaignYear("Les Vins de Mélodia 2026")).toBe("2026");
    expect(extractCampaignYear("Vente 2027 — Les vins de Mélodia")).toBe("2027");
  });

  it("returns null when no year-like token is present, never inventing one", () => {
    expect(extractCampaignYear("Les vins de Mélodia")).toBeNull();
    expect(extractCampaignYear(null)).toBeNull();
    expect(extractCampaignYear("")).toBeNull();
  });

  it("does not match a number that isn't year-shaped", () => {
    expect(extractCampaignYear("Carton de 6 vins")).toBeNull();
  });
});
