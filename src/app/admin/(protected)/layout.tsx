import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { LogoutButton } from "./logout-button";

/**
 * Shared admin shell (Phase 5 Gate 2A) — header, identity, and
 * navigation across every `/admin/**` page. Calls `requireAdmin()` for
 * its own display purposes (admin name, nav visibility) only — this is
 * NOT the authorization boundary. Next.js layouts don't re-run on
 * sibling navigation, so every individual page under `/admin` still
 * calls `requireAdmin()` itself as its own independent authorization
 * gate (Phase 3 Gate 1 decision, unchanged). React's `cache()` wrapping
 * inside `requireAdmin()` means this costs one DB round-trip per
 * request regardless of how many times it's called.
 *
 * Nav links only ever point at routes that actually exist in the
 * current gate — Commandes was added in Phase 7; Paiements/
 * Statistiques/Exports still have no link until those later phases
 * actually build those routes (no fake navigation destinations, Gate
 * 2B §15).
 *
 * `<main>` carries the shared content container (Gate 2C §1) — a
 * consistent max-width and horizontal/vertical padding for every admin
 * page's content, applied once here rather than repeated per page. The
 * header above stays full-width/unconstrained, which is deliberate
 * (Gate 2C manual review: the header composition already works).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-accent text-caption font-sans uppercase">Les vins de</p>
            <p className="font-display text-h3">Mélodia — Administration</p>
          </div>
          <nav
            className="hidden items-center gap-5 font-sans text-sm sm:flex"
            aria-label="Navigation administration"
          >
            <Link href="/admin" className="hover:text-accent transition-colors">
              Tableau de bord
            </Link>
            <Link href="/admin/campagne" className="hover:text-accent transition-colors">
              Campagne
            </Link>
            <Link href="/admin/produits" className="hover:text-accent transition-colors">
              Produits
            </Link>
            <Link href="/admin/vendeurs" className="hover:text-accent transition-colors">
              Vendeurs
            </Link>
            <Link href="/admin/commandes" className="hover:text-accent transition-colors">
              Commandes
            </Link>
            <Link href="/admin/preparation" className="hover:text-accent transition-colors">
              Préparation
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground text-body-sm font-sans">{admin.name}</p>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-6 py-10 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
