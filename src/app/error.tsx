"use client";

import { useEffect } from "react";
import { Body, Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary (Next.js 16 — the `retry` prop, not the older
 * `reset`, per node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md).
 * Catches genuine technical failures (e.g. a database/query error from
 * getPublicCatalog()) — deliberately distinct from the "no active
 * sale" business state, which src/app/page.tsx renders directly rather
 * than throwing. Generic French copy only; never the error message,
 * stack trace, or any DB detail.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Visible in server logs during SSR (Next.js already logs the
    // original render-time error); this only reaches the browser
    // console for whoever is looking at devtools, never the page.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-24 text-center sm:px-8">
      <div>
        <Display className="max-w-sm">Une erreur est survenue</Display>
        <Body className="text-foreground/75 mx-auto mt-5 max-w-sm">
          Veuillez réessayer dans quelques instants.
        </Body>
        <Button className="mt-7" onClick={() => retry()}>
          Réessayer
        </Button>
      </div>
    </div>
  );
}
