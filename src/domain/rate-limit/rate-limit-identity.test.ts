import { describe, expect, it } from "vitest";
import {
  deriveRateLimitIdentity,
  normalizeIpAddress,
  RATE_LIMIT_HMAC_DOMAIN_LABEL,
  UNKNOWN_CLIENT_IDENTITY_INPUT,
} from "./rate-limit-identity";

const TEST_SECRET = "test-only-fixed-secret-never-used-in-production";

describe("normalizeIpAddress", () => {
  it("trims whitespace", () => {
    expect(normalizeIpAddress("  203.0.113.7  ")).toBe("203.0.113.7");
  });

  it("lowercases IPv6 (hex is case-insensitive)", () => {
    expect(normalizeIpAddress("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("accepts a plain IPv4 shape", () => {
    expect(normalizeIpAddress("198.51.100.23")).toBe("198.51.100.23");
  });

  it("accepts a plain IPv6 shape", () => {
    expect(normalizeIpAddress("::1")).toBe("::1");
  });

  it("rejects null/undefined/empty/malformed input", () => {
    expect(normalizeIpAddress(null)).toBeNull();
    expect(normalizeIpAddress(undefined)).toBeNull();
    expect(normalizeIpAddress("")).toBeNull();
    expect(normalizeIpAddress("   ")).toBeNull();
    expect(normalizeIpAddress("not-an-ip")).toBeNull();
    expect(normalizeIpAddress("'; DROP TABLE orders;--")).toBeNull();
  });
});

describe("deriveRateLimitIdentity", () => {
  it("maps the same normalized IP + same secret to the same identity", () => {
    const a = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    const b = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    expect(a).toBe(b);
  });

  it("maps a different IP to a different identity", () => {
    const a = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    const b = deriveRateLimitIdentity("203.0.113.8", TEST_SECRET);
    expect(a).not.toBe(b);
  });

  it("maps a different secret to a different identity for the same IP (domain/secret separation)", () => {
    const a = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    const b = deriveRateLimitIdentity("203.0.113.7", "a-completely-different-secret");
    expect(a).not.toBe(b);
  });

  it("never contains the raw IP in its output", () => {
    const identity = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    expect(identity).not.toContain("203.0.113.7");
  });

  it("produces a hex-encoded SHA-256 digest (64 hex chars) — deterministic format, not a brittle exact-value snapshot", () => {
    const identity = deriveRateLimitIdentity("203.0.113.7", TEST_SECRET);
    expect(identity).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the shared unknown fallback produces one consistent identity, not a per-call-unique one", () => {
    const a = deriveRateLimitIdentity(UNKNOWN_CLIENT_IDENTITY_INPUT, TEST_SECRET);
    const b = deriveRateLimitIdentity(UNKNOWN_CLIENT_IDENTITY_INPUT, TEST_SECRET);
    expect(a).toBe(b);
  });

  it("uses the fixed domain-separation label internally (changing it would change every identity)", () => {
    // Not directly observable from the public API by design — this
    // documents the invariant rather than reaching into internals.
    expect(RATE_LIMIT_HMAC_DOMAIN_LABEL).toBe("melodia-rate-limit-v1");
  });
});
