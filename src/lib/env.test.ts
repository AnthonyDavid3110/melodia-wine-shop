import { describe, expect, it } from "vitest";
import { parseEnv, serverSchema } from "./env";

describe("parseEnv", () => {
  it("accepts a known NODE_ENV value", () => {
    const result = parseEnv(serverSchema, { NODE_ENV: "test" });
    expect(result.NODE_ENV).toBe("test");
  });

  it("defaults NODE_ENV when missing", () => {
    const result = parseEnv(serverSchema, {});
    expect(result.NODE_ENV).toBe("development");
  });

  it("throws with a readable message for an invalid NODE_ENV value", () => {
    expect(() => parseEnv(serverSchema, { NODE_ENV: "staging" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
