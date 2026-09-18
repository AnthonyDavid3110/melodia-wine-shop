import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  title: "Administration — Mélodia",
};

/**
 * Minimal Phase 3 admin root — proves authenticated access works.
 * Deliberately no Phase 4+ business functionality (orders, campaigns,
 * etc.). `requireAdmin()` is the actual authorization boundary here —
 * Proxy (src/proxy.ts) only optimistically redirected obviously-
 * anonymous requests before this ever rendered; this call is what
 * actually enforces it (session validity AND admin_users.active),
 * independent of whether Proxy ran at all.
 */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-8">
        <div>
          <p className="text-caption text-accent font-sans uppercase">Les vins de</p>
          <p className="font-display text-h3">Mélodia — Administration</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground text-body-sm font-sans">{admin.name}</p>
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-16 text-center sm:px-8">
        <div>
          <p className="font-display text-h2">Espace protégé</p>
          <p className="text-muted-foreground text-body mt-3 max-w-sm font-sans">
            Cette zone est réservée aux administrateurs authentifiés de l&apos;Ensemble de Cuivres
            Mélodia.
          </p>
        </div>
      </div>
    </main>
  );
}
