import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { getRateLimitClientIp } from "@/lib/rate-limit-client-ip";
import {
  deriveRateLimitIdentity,
  UNKNOWN_CLIENT_IDENTITY_INPUT,
} from "@/domain/rate-limit/rate-limit-identity";

/** Mirrors `AppBaseUrlNotConfiguredError`'s "fail loudly at point of use" pattern (`src/lib/app-url.ts`) — never silently skips rate limiting because of a misconfiguration. */
export class RateLimitSecretNotConfiguredError extends Error {
  constructor() {
    super("RATE_LIMIT_SECRET is not configured.");
    this.name = "RateLimitSecretNotConfiguredError";
  }
}

/**
 * The one composition point the action layer calls to answer "who is
 * making this request", as an opaque rate-limit bucket key (Phase 14
 * Gate 14B). Reads the verified-trusted Vercel forwarding header
 * (`rate-limit-client-ip.ts`) — never a client-asserted value — and
 * folds it through the dedicated HMAC secret. Never returns, logs, or
 * persists the raw IP or the secret itself.
 */
export async function getCurrentRateLimitIdentity(): Promise<string> {
  if (!serverEnv.RATE_LIMIT_SECRET) {
    throw new RateLimitSecretNotConfiguredError();
  }
  const clientIp = getRateLimitClientIp(await headers());
  return deriveRateLimitIdentity(
    clientIp ?? UNKNOWN_CLIENT_IDENTITY_INPUT,
    serverEnv.RATE_LIMIT_SECRET,
  );
}
