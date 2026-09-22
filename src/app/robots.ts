import type { MetadataRoute } from "next";

/**
 * Admin routes are never intended for indexing (Phase 4 Gate 2 §9).
 * `/test` (Phase 10 Gate 10B) is the fake payment provider's page —
 * already 404s outside a test run (see src/app/test/fake-saferpay),
 * excluded here too as defence in depth.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/test"],
    },
  };
}
