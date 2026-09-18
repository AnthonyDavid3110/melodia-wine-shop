import type { MetadataRoute } from "next";

/** Admin routes are never intended for indexing (Phase 4 Gate 2 §9). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
  };
}
