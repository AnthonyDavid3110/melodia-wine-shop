import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Typographic roles (docs/07-DESIGN-SYSTEM.md §16/§60). Sizes/weights come
 * from the --text-* theme tokens in globals.css — components here only
 * choose the right role + semantic tag, so no component ever hand-picks a
 * font size. `as` lets callers change the tag without changing the role
 * (e.g. a Display used as a <p> inside a dialog).
 */

type PolymorphicProps<Tag extends React.ElementType> = {
  as?: Tag;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<Tag>, "as" | "className">;

function makeRole<DefaultTag extends React.ElementType>(
  defaultTag: DefaultTag,
  roleClassName: string,
) {
  function RoleComponent<Tag extends React.ElementType = DefaultTag>({
    as,
    className,
    ...props
  }: PolymorphicProps<Tag>) {
    const Comp = (as ?? defaultTag) as React.ElementType;
    return <Comp className={cn(roleClassName, className)} {...props} />;
  }
  return RoleComponent;
}

export const Display = makeRole("h1", "font-display text-display text-balance");
export const H1 = makeRole("h1", "font-display text-h1 text-balance");
export const H2 = makeRole("h2", "font-display text-h2 text-balance");
export const H3 = makeRole("h3", "font-display text-h3");

export const BodyLarge = makeRole("p", "font-sans text-body-lg");
export const Body = makeRole("p", "font-sans text-body");
export const BodySmall = makeRole("p", "font-sans text-body-sm");

export const FieldLabel = makeRole("span", "font-sans text-label");
export const Price = makeRole("span", "font-sans text-price tabular-nums");
export const Metadata = makeRole("span", "font-sans text-metadata text-muted-foreground");

/** The small-caps editorial caption device — "VENTE 2026 · ...", "PL. 0X". */
export const Eyebrow = makeRole("p", "font-sans text-caption text-accent uppercase");
