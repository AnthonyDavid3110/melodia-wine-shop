import Link from "next/link";
import { Metadata as MetadataText } from "@/components/ui/typography";
import { ORGANISATION_IDENTITY } from "@/domain/documents/organisation-identity";
import { BrandMark } from "./brand-mark";

/**
 * Closing footer — brand, ECM's real organisation identity, the one
 * real legal link (TBD-SEC-006, `/confidentialite`), and a secondary
 * developer credit, composed as one intentional layout rather than an
 * isolated line (Phase 15 footer refinement). No fabricated
 * contact/social links.
 */
export function PublicFooter() {
  const [careOf, street, ...rest] = ORGANISATION_IDENTITY.addressLines;

  return (
    <footer className="border-border mt-auto border-t px-5 py-10 sm:px-8">
      <div className="sm:divide-border mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:divide-x">
        <div className="shrink-0 sm:pr-8">
          <BrandMark />
        </div>

        <div className="sm:px-8">
          <p className="text-muted-foreground font-sans text-caption uppercase">
            {ORGANISATION_IDENTITY.name}
          </p>
          <p className="text-foreground/60 mt-2 font-sans text-sm">{careOf}</p>
          <p className="text-foreground/60 font-sans text-sm">{street}</p>
          <p className="text-foreground/60 font-sans text-sm">{rest.join(" · ")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:pl-8">
          <Link
            href="/confidentialite"
            className="text-muted-foreground font-sans text-caption uppercase underline-offset-2 hover:underline"
          >
            Confidentialité &amp; mentions légales
          </Link>
          <MetadataText className="text-muted-foreground/60">
            Développé avec bien trop de café par{" "}
            <a href="mailto:info@anthonydavid.ch" className="underline-offset-2 hover:underline">
              Anthony David
            </a>
          </MetadataText>
        </div>
      </div>
    </footer>
  );
}
