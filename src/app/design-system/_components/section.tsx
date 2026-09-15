import type { ReactNode } from "react";
import { Eyebrow, H2, Body } from "@/components/ui/typography";

export function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-t py-12 first:border-t-0 first:pt-0">
      <div className="mb-6 max-w-2xl">
        <Eyebrow as="p">{eyebrow}</Eyebrow>
        <H2 className="mt-2">{title}</H2>
        {description ? (
          <Body as="p" className="text-muted-foreground mt-2">
            {description}
          </Body>
        ) : null}
      </div>
      {children}
    </section>
  );
}
