/**
 * Deliberate editorial placeholder for a missing product/bundle image
 * (Phase 4 Gate 1/2 — "prefer a deliberate editorial placeholder rather
 * than random stock wine photography that could be mistaken for the
 * real product"). Promoted from src/app/design-system's demo-only
 * version — production code must not import anything from that
 * directory. Uses `currentColor` so it inherits whatever text color the
 * surrounding surface sets (paper-on-ink, ink-on-paper, ink-on-oxblood).
 */
export function PlaceholderBottle({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 320"
      role="img"
      aria-label={`Photo provisoire — ${label}`}
      className={className}
    >
      <rect x="46" y="0" width="28" height="10" rx="2" fill="currentColor" />
      <path
        d="M50 8h20a4 4 0 0 1 4 4v18l10 22a10 10 0 0 1 1 4v230a14 14 0 0 1-14 14H49a14 14 0 0 1-14-14V56a10 10 0 0 1 1-4l10-22V12a4 4 0 0 1 4-4z"
        fill="currentColor"
      />
    </svg>
  );
}
