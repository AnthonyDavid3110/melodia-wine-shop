/**
 * Centralized wine-bottle placeholder shape used by all three Phase 1
 * design explorations, so no direction relies on unrelated stock imagery.
 * Each concept applies its own colour/lighting treatment around this shape
 * via className/style on the wrapping element — the silhouette itself is
 * shared to keep the comparison fair.
 */
export function PlaceholderBottle({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 320"
      role="img"
      aria-label={`Photo provisoire — ${label}`}
      className={className}
      style={style}
    >
      <rect x="46" y="0" width="28" height="10" rx="2" fill="currentColor" />
      <path
        d="M50 8h20a4 4 0 0 1 4 4v18l10 22a10 10 0 0 1 1 4v230a14 14 0 0 1-14 14H49a14 14 0 0 1-14-14V56a10 10 0 0 1 1-4l10-22V12a4 4 0 0 1 4-4z"
        fill="currentColor"
      />
    </svg>
  );
}
