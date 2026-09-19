import { describe, expect, it } from "vitest";
import { moveOrderedItem } from "./ordering";

function items(...orders: number[]) {
  return orders.map((displayOrder, i) => ({ id: `item-${i}`, displayOrder }));
}

describe("moveOrderedItem", () => {
  it("moves a middle item up", () => {
    const result = moveOrderedItem(items(0, 1, 2), "item-1", "up");
    expect(result.map((i) => i.id)).toEqual(["item-1", "item-0", "item-2"]);
    expect(result.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
  });

  it("moves a middle item down", () => {
    const result = moveOrderedItem(items(0, 1, 2), "item-1", "down");
    expect(result.map((i) => i.id)).toEqual(["item-0", "item-2", "item-1"]);
  });

  it("moving the first item up is a no-op (still renumbered densely)", () => {
    const result = moveOrderedItem(items(5, 10, 20), "item-0", "up");
    expect(result.map((i) => i.id)).toEqual(["item-0", "item-1", "item-2"]);
    expect(result.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
  });

  it("moving the last item down is a no-op (still renumbered densely)", () => {
    const result = moveOrderedItem(items(0, 1, 2), "item-2", "down");
    expect(result.map((i) => i.id)).toEqual(["item-0", "item-1", "item-2"]);
  });

  it("normalizes gaps and collisions in stored displayOrder", () => {
    // item-0 and item-1 collide at 7; item-2 has a large gap.
    const gappy = [
      { id: "item-0", displayOrder: 7 },
      { id: "item-1", displayOrder: 7 },
      { id: "item-2", displayOrder: 100 },
    ];
    const result = moveOrderedItem(gappy, "item-2", "up");
    expect(result.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
  });

  it("repeated moves converge correctly (move up twice from the end)", () => {
    let current = items(0, 1, 2, 3);
    current = moveOrderedItem(current, "item-3", "up");
    current = moveOrderedItem(current, "item-3", "up");
    expect(current.map((i) => i.id)).toEqual(["item-0", "item-3", "item-1", "item-2"]);
  });

  it("throws when the id is not present", () => {
    expect(() => moveOrderedItem(items(0, 1), "missing", "up")).toThrow();
  });
});
