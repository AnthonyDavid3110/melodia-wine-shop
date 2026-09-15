/**
 * Standalone placeholder bottle silhouette for /design-system. Deliberately
 * not imported from src/app/design/_components — that subtree stays
 * disposable and production/demo code must not depend on it.
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
