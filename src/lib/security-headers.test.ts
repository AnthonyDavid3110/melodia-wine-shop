import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, getSecurityHeaders } from "./security-headers";

function directives(csp: string): Record<string, string> {
  const entries = csp.split(";").map((d) => d.trim());
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const [name, ...rest] = entry.split(" ");
    if (name) map[name] = rest.join(" ");
  }
  return map;
}

describe("getSecurityHeaders", () => {
  it("includes all five required headers, exactly once each", () => {
    const headers = getSecurityHeaders(false);
    const keys = headers.map((h) => h.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    const headers = getSecurityHeaders(false);
    expect(headers.find((h) => h.key === "X-Content-Type-Options")?.value).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY (defense-in-depth alongside CSP frame-ancestors)", () => {
    const headers = getSecurityHeaders(false);
    expect(headers.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
  });

  it("sets a deliberate Referrer-Policy", () => {
    const headers = getSecurityHeaders(false);
    expect(headers.find((h) => h.key === "Referrer-Policy")?.value).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("denies camera, microphone and geolocation via Permissions-Policy", () => {
    const headers = getSecurityHeaders(false);
    const value = headers.find((h) => h.key === "Permissions-Policy")?.value ?? "";
    expect(value).toContain("camera=()");
    expect(value).toContain("microphone=()");
    expect(value).toContain("geolocation=()");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("contains every required directive", () => {
    const csp = directives(buildContentSecurityPolicy(false));
    for (const name of [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "object-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
    ]) {
      expect(csp).toHaveProperty(name);
    }
  });

  it("has no wildcard source anywhere", () => {
    expect(buildContentSecurityPolicy(false)).not.toContain("*");
  });

  it("sets object-src to 'none'", () => {
    expect(directives(buildContentSecurityPolicy(false))["object-src"]).toBe("'none'");
  });

  it("sets frame-ancestors to 'none'", () => {
    expect(directives(buildContentSecurityPolicy(false))["frame-ancestors"]).toBe("'none'");
  });

  it("restricts base-uri to 'self'", () => {
    expect(directives(buildContentSecurityPolicy(false))["base-uri"]).toBe("'self'");
  });

  it("restricts form-action to 'self'", () => {
    expect(directives(buildContentSecurityPolicy(false))["form-action"]).toBe("'self'");
  });

  it("scopes img-src to same-origin plus data:/blob: only — no external image host", () => {
    expect(directives(buildContentSecurityPolicy(false))["img-src"]).toBe("'self' data: blob:");
  });

  it("scopes font-src to same-origin only (next/font self-hosts)", () => {
    expect(directives(buildContentSecurityPolicy(false))["font-src"]).toBe("'self'");
  });

  it("scopes connect-src to same-origin only (no client-side fetch to any third party)", () => {
    expect(directives(buildContentSecurityPolicy(false))["connect-src"]).toBe("'self'");
  });

  it("never includes 'unsafe-eval' in the production policy", () => {
    expect(buildContentSecurityPolicy(false)).not.toContain("unsafe-eval");
  });

  it("includes 'unsafe-eval' only in the development policy", () => {
    expect(buildContentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });

  it("includes 'unsafe-inline' in script-src and style-src in both environments (static, no-nonce CSP)", () => {
    for (const isDev of [true, false]) {
      const csp = directives(buildContentSecurityPolicy(isDev));
      expect(csp["script-src"]).toContain("'unsafe-inline'");
      expect(csp["style-src"]).toContain("'unsafe-inline'");
    }
  });
});
