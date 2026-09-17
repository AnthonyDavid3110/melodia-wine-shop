import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { parseOrderNumber } from "@/domain/order-number";
import { reserveOrderNumber } from "../order-number-counter";
import { orderNumberCounters } from "../schema";
import { db } from "./setup";

// Uses real committed writes against the shared counter row on purpose
// — this specifically proves atomicity under concurrent COMMITTED
// transactions, which the withRollback-per-test pattern used elsewhere
// in this suite cannot exercise (nothing there ever actually commits).
// Test years are randomized within 9000-9999: implausible as a real
// campaign year (formatOrderNumber requires a genuine 4-digit year, so
// we can't go outside that range) and unlikely to collide with the
// seed script or other concurrent runs; cleaned up afterward so
// repeated `pnpm test:db` runs stay deterministic.

const issuedTestYears = new Set<number>();

/** Never returns the same year twice within one test run. */
function testYear(): number {
  let year: number;
  do {
    year = 9000 + Math.floor(Math.random() * 1000);
  } while (issuedTestYears.has(year));
  issuedTestYears.add(year);
  return year;
}

const usedYears: number[] = [];

afterEach(async () => {
  while (usedYears.length > 0) {
    const year = usedYears.pop();
    if (year !== undefined) {
      await db.delete(orderNumberCounters).where(eq(orderNumberCounters.year, year));
    }
  }
});

describe("reserveOrderNumber concurrency", () => {
  it("issues unique, gapless sequence values under concurrent requests", async () => {
    const year = testYear();
    usedYears.push(year);

    const concurrency = 25;
    const orderNumbers = await Promise.all(
      Array.from({ length: concurrency }, () => reserveOrderNumber(db, year)),
    );

    // All unique.
    expect(new Set(orderNumbers).size).toBe(concurrency);

    // All well-formed ECM-YYYY-NNNN, and their sequence numbers form
    // exactly 1..concurrency with no duplicates and no gaps.
    const sequences = orderNumbers.map((orderNumber) => {
      const parsed = parseOrderNumber(orderNumber);
      expect(parsed).not.toBeNull();
      expect(parsed?.year).toBe(year);
      return parsed?.sequence;
    });
    expect(new Set(sequences).size).toBe(concurrency);
    expect([...sequences].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: concurrency }, (_, i) => i + 1),
    );
  });

  it("keeps independent counters for different years", async () => {
    const yearA = testYear();
    const yearB = testYear();
    usedYears.push(yearA, yearB);

    const [firstA, firstB, secondA] = await Promise.all([
      reserveOrderNumber(db, yearA),
      reserveOrderNumber(db, yearB),
      reserveOrderNumber(db, yearA),
    ]);

    expect(parseOrderNumber(firstA)?.year).toBe(yearA);
    expect(parseOrderNumber(firstB)?.year).toBe(yearB);
    expect(parseOrderNumber(secondA)?.year).toBe(yearA);

    // Year B only ever requested once — its own sequence starts at 1
    // regardless of how far year A's has advanced.
    expect(parseOrderNumber(firstB)?.sequence).toBe(1);
  });

  it("does not use SELECT MAX()-style logic — sequential calls strictly increment", async () => {
    const year = testYear();
    usedYears.push(year);

    const first = await reserveOrderNumber(db, year);
    const second = await reserveOrderNumber(db, year);
    const third = await reserveOrderNumber(db, year);

    expect(parseOrderNumber(first)?.sequence).toBe(1);
    expect(parseOrderNumber(second)?.sequence).toBe(2);
    expect(parseOrderNumber(third)?.sequence).toBe(3);
  });
});
