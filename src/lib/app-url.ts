import "server-only";
import { serverEnv } from "./env";

/**
 * Thrown when `APP_BASE_URL` is not configured at the point a URL is
 * actually needed (Phase 10 Gate 10C-B1) — mirrors the
 * `SaferpayConfigurationError` pattern: asserted at point of use, not
 * at module load time.
 */
export class AppBaseUrlNotConfiguredError extends Error {
  constructor() {
    super("APP_BASE_URL is not configured. Set it in .env.local — see .env.example.");
    this.name = "AppBaseUrlNotConfiguredError";
  }
}

/**
 * Builds an absolute, application-owned URL from `APP_BASE_URL` — the
 * only externally reachable URLs this application currently constructs
 * for a third party are Saferpay's `ReturnUrl`/`SuccessNotifyUrl`/
 * `FailNotifyUrl`. Uses the `URL` constructor (never naive string
 * concatenation), so a trailing or missing slash in `APP_BASE_URL` can
 * never produce a malformed or double-slashed URL.
 */
export function appUrl(path: string, searchParams?: Record<string, string>): string {
  if (!serverEnv.APP_BASE_URL) {
    throw new AppBaseUrlNotConfiguredError();
  }
  const url = new URL(path, serverEnv.APP_BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
