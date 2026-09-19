/**
 * Pure display-order reordering (Phase 5 Gate 2B) — move-up/move-down
 * only, no drag-and-drop, no admin-managed raw numbers. Always
 * renumbers the whole list to a dense 0..n-1 sequence, so gaps or
 * collisions in the stored `displayOrder` values (e.g. from a partial
 * past migration) self-heal on the next move rather than compounding.
 */
export interface OrderedItem {
  id: string;
  displayOrder: number;
}

export function moveOrderedItem<T extends OrderedItem>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  const index = sorted.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error(`moveOrderedItem: item ${id} not found in the given list.`);
  }

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sorted.length) {
    // Already at the boundary — no-op, but still renumber densely so a
    // previously-gappy/colliding stored order is normalized.
    return sorted.map((item, i) => ({ ...item, displayOrder: i }));
  }

  const reordered = [...sorted];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
  return reordered.map((item, i) => ({ ...item, displayOrder: i }));
}
