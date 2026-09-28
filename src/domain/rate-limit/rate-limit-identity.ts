import { createHmac } from "node:crypto";

/**
 * Fixed domain-separation label folded into every HMAC computation
 * (Phase 14 Gate 14B, approved Step 1 §5) — cheap insurance against
 * accidental key reuse even though `RATE_LIMIT_SECRET` is already a
 * dedicated, purpose-specific secret.
 */
export const RATE_LIMIT_HMAC_DOMAIN_LABEL = "melodia-rate-limit-v1";

/**
 * Shared fallback identity input when no trustworthy client IP can be
 * derived (approved Step 1 §7) — deliberately one fixed string, never a
 * per-request-unique value, so all such traffic shares one bounded
 * quota rather than silently bypassing the limiter entirely.
 */
export const UNKNOWN_CLIENT_IDENTITY_INPUT = "unknown";

/**
 * Normalizes a raw IP-shaped string before hashing (Phase 14 Gate 14B)
 * — trims whitespace, lowercases (IPv6 hex is case-insensitive, e.g.
 * `2001:DB8::1` and `2001:db8::1` are the same address), and rejects
 * anything that isn't at least shaped like an IPv4 or IPv6 address.
 * This is a light sanity check, not a full RFC-compliant parser — its
 * job is only to make sure the same real address always normalizes to
 * the same string before it reaches `deriveRateLimitIdentity()`, and to
 * refuse obviously-unusable input (empty, whitespace-only, or clearly
 * not an address) rather than hashing garbage.
 */
export function normalizeIpAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  const isIpv4Shaped = /^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed);
  const isIpv6Shaped = /^[0-9a-f:]+$/.test(trimmed) && trimmed.includes(":");
  if (!isIpv4Shaped && !isIpv6Shaped) return null;

  return trimmed;
}

/**
 * `HMAC-SHA-256(RATE_LIMIT_SECRET, domain-label + ":" + identityInput)`
 * (Phase 14 Gate 14B, approved Step 1 §5/§6) — the ONLY thing ever
 * persisted or logged for rate-limiting purposes. Irreversible without
 * the secret; the same normalized IP (or the shared `"unknown"`
 * fallback) always maps to the same digest, so repeated requests from
 * the same source correctly accumulate against the same bucket. Never
 * returns or logs the raw input.
 */
export function deriveRateLimitIdentity(identityInput: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${RATE_LIMIT_HMAC_DOMAIN_LABEL}:${identityInput}`)
    .digest("hex");
}
