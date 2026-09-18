import { betterAuth } from "better-auth";
import { serverEnv } from "@/lib/env";
import { createAuthConfig } from "./config";

if (!serverEnv.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not configured. Set it in .env.local (a fixed fake value in development; a freshly generated one in production) — see .env.example.",
  );
}

if (!serverEnv.BETTER_AUTH_URL) {
  throw new Error(
    "BETTER_AUTH_URL is not configured. Set it in .env.local (http://localhost:3000 in development, https://vins.ecmelodia.ch in production) — see .env.example.",
  );
}

/**
 * The deployed application's Better Auth instance. Public registration
 * is always disabled here (see ./config.ts) — the only way to create an
 * administrator is the bootstrap script or an already-authenticated
 * admin (invitation UI deferred, Gate 2 decision 15).
 */
export const auth = betterAuth(createAuthConfig());
