import "server-only";
import { normalizeIpAddress } from "@/domain/rate-limit/rate-limit-identity";

/**
 * The ONE place in the codebase that reads a forwarding header for
 * rate-limiting trust purposes (Phase 14 Gate 14B, approved Step 1 §4).
 *
 * Trust model, verified against Vercel's own current official
 * documentation (vercel.com/docs/headers/request-headers, accessed
 * during Gate 14B implementation) before writing this function:
 *
 * - `x-forwarded-for` is documented by Vercel as "the public IP address
 *   of the client that made the request", and Vercel explicitly states
 *   it "overwrite[s] the X-Forwarded-For header and do[es] not forward
 *   external IPs" — i.e. on Vercel's own platform this header is NOT
 *   attacker-spoofable by default. A custom/passthrough value is only
 *   possible for Enterprise customers who have explicitly purchased and
 *   enabled a "Trusted Proxy" feature — not used by this project.
 * - `x-vercel-forwarded-for` is documented as "identical to
 *   `x-forwarded-for`. However, `x-forwarded-for` could be overwritten
 *   if you're using a proxy on top of Vercel" — i.e. it is Vercel's own
 *   more robust, always-Vercel-set header, unaffected even if a future
 *   proxy/WAF is later added in front of this deployment. Preferred as
 *   the primary source for exactly that reason; `x-forwarded-for`
 *   remains a safe fallback (both are trustworthy on this project's
 *   current deployment shape, which has no such intermediate proxy).
 *
 * In local development (no Vercel edge in front), neither header is set
 * by any trusted party — an arbitrary client can set anything. This
 * function does not special-case that: it simply won't find a usable
 * value there, and the caller falls back to the shared "unknown"
 * identity (`rate-limit-identity.ts`), never a client-asserted one.
 */
export function getRateLimitClientIp(requestHeaders: Headers): string | null {
  const candidate =
    requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-forwarded-for");
  if (!candidate) return null;

  // Defensive only — Vercel's own docs describe this as the single real
  // client IP, not a chain, but a comma-separated value costs nothing
  // extra to handle safely (take the first/leftmost entry).
  const firstEntry = candidate.split(",")[0] ?? "";
  return normalizeIpAddress(firstEntry);
}
