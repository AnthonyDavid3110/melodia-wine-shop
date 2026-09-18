import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminOrNull } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — Administration Mélodia",
};

/**
 * Must remain reachable anonymously (Proxy redirects unauthenticated
 * `/admin/**` traffic here — src/proxy.ts — so this route itself must
 * never bounce an anonymous visitor, or that becomes a redirect loop).
 * No registration link, no social login, no MFA, no password-reset
 * link — none of that exists yet in this gate (see the Gate 2B report).
 */
export default async function AdminLoginPage() {
  const admin = await getAdminOrNull();
  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="text-caption text-accent font-sans uppercase">Les vins de</p>
          <p className="font-display text-h2">Mélodia</p>
          <p className="text-muted-foreground text-body-sm mt-3 font-sans">Administration</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
