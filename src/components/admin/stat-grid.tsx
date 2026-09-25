import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string;
}

const columnsClass: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * Restrained KPI display (docs/07-DESIGN-SYSTEM.md §45: no giant metric
 * cards, no gradients) — the same hairline border-grid motif already
 * used for the admin homepage's section nav, applied to label/value
 * pairs instead of links. Deliberately plain `<dl>` markup, not a
 * `Card`-per-stat wall.
 */
export function StatGrid({ stats, columns = 4 }: { stats: Stat[]; columns?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("border-border bg-border grid gap-px border", columnsClass[columns])}>
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface flex flex-col gap-1 p-4">
          <dt className="text-muted-foreground text-caption font-sans tracking-widest uppercase">
            {stat.label}
          </dt>
          <dd className="font-display text-h3 tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
