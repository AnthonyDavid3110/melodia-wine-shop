import type { Metadata } from "next";
import { ExplorationBar } from "./_components/exploration-bar";

/**
 * Temporary Phase 1 design-exploration subtree. Everything under
 * src/app/design/ is isolated and disposable — deleting this directory
 * removes the exploration cleanly with no effect on the rest of the app.
 */
export const metadata: Metadata = {
  title: "Design exploration — Melodia Wine Shop",
  robots: { index: false, follow: false },
};

export default function DesignExplorationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ExplorationBar />
      {children}
    </div>
  );
}
