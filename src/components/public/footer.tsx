import Link from "next/link";
import { Metadata as MetadataText } from "@/components/ui/typography";

/**
 * Restrained closing footer — ECM identity, the one real legal link
 * (TBD-SEC-006, `/confidentialite`), and a secondary developer credit.
 * No fabricated contact/social links.
 */
export function PublicFooter() {
  return (
    <footer className="border-border mt-auto border-t px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground font-sans text-caption uppercase">
          Ensemble de Cuivres Mélodia
        </p>
        <Link
          href="/confidentialite"
          className="text-muted-foreground font-sans text-caption uppercase underline-offset-2 hover:underline"
        >
          Confidentialité &amp; mentions légales
        </Link>
      </div>
      <MetadataText className="mx-auto mt-4 max-w-5xl text-muted-foreground/60">
        Développé avec bien trop de café par{" "}
        <a href="mailto:info@anthonydavid.ch" className="underline-offset-2 hover:underline">
          Anthony David
        </a>
      </MetadataText>
    </footer>
  );
}
