"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const concepts = [
  { slug: "programme", label: "1. Programme" },
  { slug: "cuivres", label: "2. Cuivres" },
  { slug: "sourdine", label: "3. Sourdine" },
  { slug: "programme-v2", label: "Programme V2" },
];

const neutralFontStack =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Meta-navigation for comparing the three Phase 1 concepts. Deliberately
 * styled with a plain system font stack — independent of any concept's own
 * typography — so this chrome never influences the visual comparison.
 */
export function ExplorationBar() {
  const pathname = usePathname();

  return (
    <div
      style={{ fontFamily: neutralFontStack }}
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 bg-white px-4 py-2 text-neutral-800"
    >
      <span className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Design exploration — Phase 1 — internal only, not production
      </span>
      <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Concepts">
        <Link
          href="/design"
          className="rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          Index
        </Link>
        {concepts.map((concept) => {
          const href = `/design/${concept.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={concept.slug}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "rounded bg-neutral-900 px-2 py-1 font-medium text-white"
                  : "rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }
            >
              {concept.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
