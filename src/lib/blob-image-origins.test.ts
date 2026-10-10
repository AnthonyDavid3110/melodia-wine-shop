import { describe, expect, it } from "vitest";
import {
  BLOB_STORAGE_HOSTNAMES,
  buildBlobRemotePatterns,
  isAllowedImageHost,
} from "./blob-image-origins";

const EXPECTED_HOSTNAMES = [
  "du7clicrjnwnwcsd.public.blob.vercel-storage.com",
  "wuzsx6hg7jjpz5pr.public.blob.vercel-storage.com",
];
const EXPECTED_PATHNAMES = ["/products/**", "/bundles/**"];

describe("BLOB_STORAGE_HOSTNAMES", () => {
  it("contains exactly the two approved public Blob store hostnames", () => {
    expect(BLOB_STORAGE_HOSTNAMES).toEqual(EXPECTED_HOSTNAMES);
  });

  it("contains no wildcard hostname", () => {
    for (const hostname of BLOB_STORAGE_HOSTNAMES) {
      expect(hostname).not.toContain("*");
    }
  });
});

describe("buildBlobRemotePatterns", () => {
  const patterns = buildBlobRemotePatterns();

  it("produces exactly four entries (two hostnames × two pathnames)", () => {
    expect(patterns).toHaveLength(4);
  });

  it("requires https for every entry", () => {
    for (const pattern of patterns) {
      expect(pattern.protocol).toBe("https");
    }
  });

  it("includes both approved hostnames, no others", () => {
    const hostnames = new Set(patterns.map((p) => p.hostname));
    expect(hostnames).toEqual(new Set(EXPECTED_HOSTNAMES));
  });

  it("allows exactly /products/** and /bundles/** for each hostname, nothing broader", () => {
    for (const hostname of EXPECTED_HOSTNAMES) {
      const pathnames = patterns.filter((p) => p.hostname === hostname).map((p) => p.pathname);
      expect(new Set(pathnames)).toEqual(new Set(EXPECTED_PATHNAMES));
    }
  });

  it("never configures an unrestricted pathname", () => {
    for (const pattern of patterns) {
      expect(pattern.pathname).not.toBe("/**");
      expect(pattern.pathname).not.toBe("**");
      expect(pattern.pathname).not.toBe("/");
      expect(pattern.pathname).not.toBeUndefined();
    }
  });

  it("never configures a wildcard hostname", () => {
    for (const pattern of patterns) {
      expect(pattern.hostname).not.toContain("*");
    }
  });
});

describe("isAllowedImageHost — Gate ARCH-006-D review finding", () => {
  it("accepts a URL on either approved Blob hostname", () => {
    for (const hostname of EXPECTED_HOSTNAMES) {
      expect(isAllowedImageHost(`https://${hostname}/products/x.jpg`)).toBe(true);
    }
  });

  it("rejects a legacy/arbitrary external host", () => {
    expect(isAllowedImageHost("https://evil.example.com/image.jpg")).toBe(false);
  });

  it("rejects a host that merely contains an approved hostname as a substring", () => {
    expect(isAllowedImageHost(`https://evil-${EXPECTED_HOSTNAMES[0]}.attacker.test/x.jpg`)).toBe(
      false,
    );
    expect(isAllowedImageHost(`https://${EXPECTED_HOSTNAMES[0]}.evil.test/x.jpg`)).toBe(false);
  });

  it("never throws on a malformed/non-URL string — treated as not allowed", () => {
    expect(isAllowedImageHost("not a url at all")).toBe(false);
    expect(isAllowedImageHost("")).toBe(false);
  });
});
