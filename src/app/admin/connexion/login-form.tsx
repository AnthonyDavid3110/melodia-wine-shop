"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

/**
 * Deliberately the ONLY error message this form ever shows, regardless
 * of what Better Auth's API actually returned (unknown email, wrong
 * password, or anything else) — never reflects `error.message` from the
 * response. Better Auth's own sign-in route already collapses "unknown
 * email" and "wrong password" into the same INVALID_EMAIL_OR_PASSWORD
 * code server-side (verified in node_modules/.../api/routes/sign-in.mjs);
 * this is a second, independent layer so no future server-side error
 * variant can leak account existence through the UI (Gate 2B requirement).
 */
const GENERIC_ERROR = "Adresse e-mail ou mot de passe incorrect.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });

      if (signInError) {
        setError(GENERIC_ERROR);
        setPending(false);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      // Network/unexpected failure — still never distinguishes "unknown
      // email" from anything else, and never leaves the form stuck in
      // its pending state.
      setError(GENERIC_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email">Adresse e-mail</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-password">Mot de passe</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
      </div>

      {error ? (
        <p role="alert" data-testid="login-error" className="text-danger text-body-sm font-sans">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Connexion en cours…" : "Se connecter"}
      </Button>
    </form>
  );
}
