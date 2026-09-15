import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design system — Melodia Wine Shop",
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-border bg-surface-muted text-muted-foreground border-b px-4 py-2 text-center text-xs font-medium tracking-wide uppercase">
        Foundation de design — Phase 1 — usage interne, non destiné au public
      </div>
      {children}
    </div>
  );
}
