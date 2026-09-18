import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/infrastructure/auth/server";

/**
 * Better Auth's own endpoints (sign-in, sign-out, get-session, password
 * reset, ...) — the officially recommended catch-all route
 * (better-auth.com/docs/integrations/next). Public registration is
 * disabled at the Better Auth config level (see
 * src/infrastructure/auth/config.ts), not here — there is no separate
 * sign-up route to omit.
 */
export const { GET, POST } = toNextJsHandler(auth);
