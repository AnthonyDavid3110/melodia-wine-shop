import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "@/infrastructure/rate-limit/rate-limit";
import { checkoutRateLimits } from "../schema";
import { db, withRollback } from "./setup";

function testIdentity(): string {
  return `test-identity-${randomUUID()}`;
}

describe("consumeRateLimit", () => {
  it("allows the first N requests and rejects request N+1 within the same window", async () => {
    await withRollback(async (tx) => {
      const identity = testIdentity();
      const policy = { action: "test_action", windowSeconds: 600, limit: 3 };
      const now = new Date("2026-01-01T00:00:00Z");

      const results = [];
      for (let i = 0; i < 4; i += 1) {
        results.push(await consumeRateLimit(identity, policy, tx, now));
      }

      expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    });
  });

  it("resets in the next fixed window", async () => {
    await withRollback(async (tx) => {
      const identity = testIdentity();
      const policy = { action: "test_action", windowSeconds: 600, limit: 1 };
      const windowOne = new Date("2026-01-01T00:00:00Z");
      const windowTwo = new Date("2026-01-01T00:10:00Z");

      const first = await consumeRateLimit(identity, policy, tx, windowOne);
      const second = await consumeRateLimit(identity, policy, tx, windowOne);
      const third = await consumeRateLimit(identity, policy, tx, windowTwo);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(false);
      expect(third.allowed).toBe(true);
    });
  });

  it("keeps independent action buckets from interfering with each other", async () => {
    await withRollback(async (tx) => {
      const identity = testIdentity();
      const now = new Date("2026-01-01T00:00:00Z");
      const policyA = { action: "order_creation", windowSeconds: 600, limit: 1 };
      const policyB = { action: "payment_initiation", windowSeconds: 600, limit: 1 };

      const a1 = await consumeRateLimit(identity, policyA, tx, now);
      const b1 = await consumeRateLimit(identity, policyB, tx, now);
      const a2 = await consumeRateLimit(identity, policyA, tx, now);

      expect(a1.allowed).toBe(true);
      expect(b1.allowed).toBe(true);
      expect(a2.allowed).toBe(false);
    });
  });

  it("keeps independent identities from interfering with each other", async () => {
    await withRollback(async (tx) => {
      const identityA = testIdentity();
      const identityB = testIdentity();
      const now = new Date("2026-01-01T00:00:00Z");
      const policy = { action: "test_action", windowSeconds: 600, limit: 1 };

      const a1 = await consumeRateLimit(identityA, policy, tx, now);
      const b1 = await consumeRateLimit(identityB, policy, tx, now);
      const a2 = await consumeRateLimit(identityA, policy, tx, now);

      expect(a1.allowed).toBe(true);
      expect(b1.allowed).toBe(true);
      expect(a2.allowed).toBe(false);
    });
  });

  it("a request in a past window never affects the current window's admission", async () => {
    await withRollback(async (tx) => {
      const identity = testIdentity();
      const policy = { action: "test_action", windowSeconds: 600, limit: 1 };
      const longAgo = new Date("2020-01-01T00:00:00Z");
      const today = new Date("2026-01-01T00:00:00Z");

      await consumeRateLimit(identity, policy, tx, longAgo);
      const result = await consumeRateLimit(identity, policy, tx, today);

      expect(result.allowed).toBe(true);
    });
  });

  it("persists only the opaque identity hash, action, window, and count — no raw IP/customer data, no unexpected columns", async () => {
    await withRollback(async (tx) => {
      const identity = testIdentity();
      const policy = { action: "test_action", windowSeconds: 600, limit: 5 };
      const now = new Date("2026-01-01T00:00:00Z");

      await consumeRateLimit(identity, policy, tx, now);

      const [row] = await tx
        .select()
        .from(checkoutRateLimits)
        .where(eq(checkoutRateLimits.identityHash, identity));

      expect(row).toBeDefined();
      expect(Object.keys(row!).sort()).toEqual(
        ["id", "identityHash", "action", "windowStart", "count"].sort(),
      );
      expect(row!.identityHash).toBe(identity);
      expect(row!.action).toBe("test_action");
      expect(row!.count).toBe(1);
    });
  });

  it("opportunistically cleans up rows older than the retention window", async () => {
    await withRollback(async (tx) => {
      const oldIdentity = testIdentity();
      const veryOld = new Date("2020-01-01T00:00:00Z");
      await tx.insert(checkoutRateLimits).values({
        identityHash: oldIdentity,
        action: "test_action",
        windowStart: veryOld,
        count: 1,
      });

      // Any call triggers the opportunistic cleanup pass.
      await consumeRateLimit(
        testIdentity(),
        { action: "test_action", windowSeconds: 600, limit: 5 },
        tx,
      );

      const remaining = await tx
        .select()
        .from(checkoutRateLimits)
        .where(eq(checkoutRateLimits.identityHash, oldIdentity));
      expect(remaining).toHaveLength(0);
    });
  });
});

describe("consumeRateLimit — concurrency", () => {
  it("admits no more than the configured limit under a genuine concurrent burst", async () => {
    const identity = testIdentity();
    const policy = { action: "concurrency_test", windowSeconds: 600, limit: 5 };
    const now = new Date("2026-01-01T00:00:00Z");

    try {
      const burst = await Promise.all(
        Array.from({ length: 10 }, () => consumeRateLimit(identity, policy, db, now)),
      );

      const allowedCount = burst.filter((r) => r.allowed).length;
      expect(allowedCount).toBe(5);

      const [row] = await db
        .select()
        .from(checkoutRateLimits)
        .where(eq(checkoutRateLimits.identityHash, identity));
      expect(row!.count).toBe(10);
    } finally {
      await db.delete(checkoutRateLimits).where(eq(checkoutRateLimits.identityHash, identity));
    }
  });
});
