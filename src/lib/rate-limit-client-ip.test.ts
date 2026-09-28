import { describe, expect, it } from "vitest";
import { getRateLimitClientIp } from "./rate-limit-client-ip";

describe("getRateLimitClientIp", () => {
  it("prefers x-vercel-forwarded-for over x-forwarded-for", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(getRateLimitClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1" });
    expect(getRateLimitClientIp(headers)).toBe("198.51.100.1");
  });

  it("takes only the first entry of a comma-separated value (defensive parsing)", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(getRateLimitClientIp(headers)).toBe("203.0.113.7");
  });

  it("returns null when neither header is present — never trusts an arbitrary fallback header", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7" });
    expect(getRateLimitClientIp(headers)).toBeNull();
  });

  it("returns null for a malformed value", () => {
    const headers = new Headers({ "x-forwarded-for": "not-an-ip" });
    expect(getRateLimitClientIp(headers)).toBeNull();
  });
});
