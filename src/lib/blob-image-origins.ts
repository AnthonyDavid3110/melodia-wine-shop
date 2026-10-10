/**
 * The two approved public Vercel Blob store origins (Phase 15,
 * TBD-ARCH-006, Gate ARCH-006-C) — public CDN hostnames, never
 * secrets, confirmed directly from the Vercel dashboard (Storage →
 * each store → Base URL), never derived from a `BLOB_READ_WRITE_TOKEN`.
 *
 * Statically allowlisted in every environment rather than branched on
 * `NODE_ENV`/`VERCEL_ENV`: both hostnames are public, non-secret
 * identifiers, so listing both everywhere costs nothing security-wise
 * and avoids a class of bug where a Preview deployment can't render
 * images because only one environment's hostname was allowlisted at
 * build time (docs/09-SECURITY.md has the full rationale).
 *
 * The one shared source both `next.config.ts`'s `images.remotePatterns`
 * and `security-headers.ts`'s `img-src` build from — the two hostnames
 * are never duplicated as separate literals.
 */
export const BLOB_STORAGE_HOSTNAMES = [
  "du7clicrjnwnwcsd.public.blob.vercel-storage.com",
  "wuzsx6hg7jjpz5pr.public.blob.vercel-storage.com",
] as const;

/** The only two pathname prefixes this feature ever writes to — matches `upload-image.ts`'s `generateImagePathname()` exactly. */
export const BLOB_IMAGE_PATHNAMES = ["/products/**", "/bundles/**"] as const;

export interface BlobRemotePattern {
  protocol: "https";
  hostname: string;
  pathname: string;
}

/**
 * Exactly `BLOB_STORAGE_HOSTNAMES.length * BLOB_IMAGE_PATHNAMES.length`
 * (four) strict entries — never a wildcard hostname, never an
 * unrestricted pathname.
 */
export function buildBlobRemotePatterns(): BlobRemotePattern[] {
  return BLOB_STORAGE_HOSTNAMES.flatMap((hostname) =>
    BLOB_IMAGE_PATHNAMES.map((pathname) => ({
      protocol: "https" as const,
      hostname,
      pathname,
    })),
  );
}

/**
 * Whether `url`'s hostname is one of the two approved Blob origins
 * (Phase 15, Gate ARCH-006-D review finding). `next/image` THROWS a
 * hard render error — not a graceful broken-image fallback — for any
 * host outside `images.remotePatterns`; a product/bundle `imageUrl`
 * that predates this gate's upload feature (or was altered by a
 * future, hypothetical write path) could carry a non-Blob host, which
 * would otherwise crash the entire page it renders on. Callers use
 * this to fall back to the existing placeholder instead of attempting
 * `next/image` for an unrecognized host — never to widen
 * `remotePatterns`/CSP, which remain exactly as strict as Gate
 * ARCH-006-C left them. Malformed input (not a valid URL at all) is
 * treated as not-allowed, never thrown.
 */
export function isAllowedImageHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (BLOB_STORAGE_HOSTNAMES as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}
