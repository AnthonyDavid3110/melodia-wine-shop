"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

/**
 * Calls Better Auth's own `/sign-out` route (revokes the caller's own
 * current session — this is exactly the "self-service" API documented
 * in src/infrastructure/auth/disable-admin.ts, appropriate here since
 * the admin is revoking their own session). Never a client-side-only
 * "forget the cookie" — the server actually invalidates the session row.
 */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await authClient.signOut();
    router.replace("/admin/connexion");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={pending}>
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
