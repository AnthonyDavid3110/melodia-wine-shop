import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 Proxy (renamed from `middleware.ts` — see
 * node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 *
 * OPTIMISTIC ONLY, per Gate 1 §10/§17 and Next's own authentication
 * guide: this reads whether a session cookie is *present*, never
 * whether it's valid, and never touches admin_users.active. Its only
 * job is redirecting obviously-anonymous requests away from /admin
 * early and cheaply, before a page even starts rendering. It must
 * never be the actual authorization boundary — every protected Server
 * Component/Action/Route Handler calls requireAdmin() (or
 * getAdminOrNull()) itself, which does the real, database-backed check
 * (src/lib/auth/dal.ts).
 */
const LOGIN_PATH = "/admin/connexion";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin") || pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
