import { describe, expect, it } from "vitest";
import { formatOrderNumber, parseOrderNumber } from "./order-number";

describe("formatOrderNumber", () => {
  it("formats and zero-pads a sequence number", () => {
    expect(formatOrderNumber(2026, 42)).toBe("ECM-2026-0042");
  });

  it("does not truncate a sequence beyond 4 digits", () => {
    expect(formatOrderNumber(2026, 12345)).toBe("ECM-2026-12345");
  });

  it("formats sequence 1 with full padding", () => {
    expect(formatOrderNumber(2026, 1)).toBe("ECM-2026-0001");
  });

  it("rejects a non-4-digit year", () => {
    expect(() => formatOrderNumber(26, 1)).toThrow(/year/);
  });

  it("rejects a zero or negative sequence", () => {
    expect(() => formatOrderNumber(2026, 0)).toThrow(/sequence/);
    expect(() => formatOrderNumber(2026, -1)).toThrow(/sequence/);
  });
});

describe("parseOrderNumber", () => {
  it("parses a well-formed order number", () => {
    expect(parseOrderNumber("ECM-2026-0042")).toEqual({ year: 2026, sequence: 42 });
  });

  it("parses a sequence beyond 4 digits", () => {
    expect(parseOrderNumber("ECM-2026-12345")).toEqual({ year: 2026, sequence: 12345 });
  });

  it("returns null for a malformed string", () => {
    expect(parseOrderNumber("not-an-order-number")).toBeNull();
    expect(parseOrderNumber("ECM-26-0042")).toBeNull();
    expect(parseOrderNumber("ECM-2026-42")).toBeNull();
  });

  it("round-trips with formatOrderNumber", () => {
    const formatted = formatOrderNumber(2026, 7);
    expect(parseOrderNumber(formatted)).toEqual({ year: 2026, sequence: 7 });
  });
});
