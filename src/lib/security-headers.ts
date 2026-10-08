/**
 * Phase 14 Gate 14C — HTTP security headers / CSP.
 *
 * Static policy (no nonces), approved direction: this app has no
 * browser-rendered `dangerouslySetInnerHTML`, no third-party analytics/
 * tracking scripts, self-hosted fonts (`next/font`), same-origin Better
 * Auth traffic, a server-side-only Saferpay API client, and a Saferpay
 * Payment Page that is a top-level browser redirect
 * (`window.location.assign`), never an iframe embed — so a nonce-based
 * strict CSP (which would force every page to dynamic rendering,
 * disabling static optimization/ISR/PPR for no demonstrated V1 need)
 * isn't justified. This is a deliberately weaker guarantee than a
 * nonce/hash-based CSP: `'unsafe-inline'` is required for Next.js's own
 * framework-injected inline scripts/styles under the no-nonce approach
 * (see node_modules/next/dist/docs/01-app/02-guides/
 * content-security-policy.md, "Without Nonces"), so this policy does
 * NOT block an inline `<script>` injected by an XSS bug the way a
 * strict CSP would. React's default JSX escaping remains the primary
 * XSS defense; this is defense-in-depth for everything else CSP
 * covers (clickjacking, MIME-sniffing, unauthorized resource origins).
 *
 * `img-src` is scoped to same-origin + `data:`/`blob:` plus the two
 * approved public Vercel Blob store origins (Phase 15, TBD-ARCH-006,
 * Gate ARCH-006-C — `blob-image-origins.ts`'s `BLOB_STORAGE_HOSTNAMES`,
 * the same source `next.config.ts`'s `images.remotePatterns` builds
 * from). No wildcard host, no bare `https:` scheme allowance — every
 * origin is an exact hostname. TBD-ARCH-006 itself remains open: this
 * is delivery/CSP only, there is still no admin upload UI.
 *
 * HTTPS enforcement and HSTS are NOT set here — Vercel's own platform
 * already forwards HTTP to HTTPS (308) and applies HSTS automatically
 * on both `.vercel.app` and custom domains (verified against
 * vercel.com/docs/cdn-security during Gate 14C Step 1), so a duplicate
 * application-level policy would be redundant, not protective.
 *
 * No CSP violation reporting (`report-to`/`report-uri`) is configured
 * — that would add a new PII-adjacent telemetry surface (client URLs/
 * IPs) not required by TBD-SEC-004's narrow scope.
 */

import { BLOB_STORAGE_HOSTNAMES } from "./blob-image-origins";

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * `'unsafe-eval'` is required only in development, matching Next.js's
 * own documented reason: React uses `eval` in development to
 * reconstruct server-side error stacks in the browser. Neither React
 * nor Next.js use `eval` in production. This project's E2E suite runs
 * against `pnpm dev` (`next dev`, NODE_ENV=development —
 * playwright.config.ts's `webServer.command`), so E2E always observes
 * the development policy; the production-excludes-`'unsafe-eval'`
 * guarantee is verified by a unit test against `isDevelopment: false`
 * directly, not by E2E.
 */
export function buildContentSecurityPolicy(isDevelopment: boolean): string {
  const blobOrigins = BLOB_STORAGE_HOSTNAMES.map((hostname) => `https://${hostname}`).join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${blobOrigins}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

/**
 * The full header set applied globally via `next.config.ts`'s
 * `headers()`. `X-Frame-Options: DENY` is kept alongside CSP's
 * `frame-ancestors 'none'` as defense-in-depth (older-browser
 * fallback) — both say the same thing, deliberately redundant.
 *
 * `Permissions-Policy` denies the three sensitive capabilities this
 * application has no current use for (camera, microphone,
 * geolocation) rather than attempting to enumerate every browser
 * feature ever defined.
 */
export function getSecurityHeaders(isDevelopment: boolean): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isDevelopment) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
