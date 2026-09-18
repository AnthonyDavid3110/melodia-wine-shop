import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client (Client Components only). No
 * `baseURL` — Better Auth's client defaults to the same-origin
 * `/api/auth` path (see node_modules/.../better-auth/dist/client/config.mjs),
 * matching the catch-all route handler
 * (src/app/api/auth/[...all]/route.ts), so nothing here needs to know
 * BETTER_AUTH_URL. This is a thin transport only — it never decides
 * authorization; every actual protected read/mutation is still gated by
 * requireAdmin()/getAdminOrNull() server-side (src/lib/auth/dal.ts).
 */
export const authClient = createAuthClient();
