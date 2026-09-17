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

  it("allows DATABASE_URL and DATABASE_URL_UNPOOLED to be absent", () => {
    const result = parseEnv(serverSchema, { NODE_ENV: "test" });
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.DATABASE_URL_UNPOOLED).toBeUndefined();
  });

  it("accepts valid DATABASE_URL and DATABASE_URL_UNPOOLED values", () => {
    const result = parseEnv(serverSchema, {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@host-pooler.neon.tech/db",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@host.neon.tech/db",
    });
    expect(result.DATABASE_URL).toContain("-pooler");
    expect(result.DATABASE_URL_UNPOOLED).not.toContain("-pooler");
  });

  it("rejects a DATABASE_URL that is not a valid URL", () => {
    expect(() => parseEnv(serverSchema, { NODE_ENV: "test", DATABASE_URL: "not-a-url" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("allows DATABASE_DRIVER to be absent", () => {
    const result = parseEnv(serverSchema, { NODE_ENV: "test" });
    expect(result.DATABASE_DRIVER).toBeUndefined();
  });

  it("accepts 'postgres' and 'neon' as DATABASE_DRIVER values", () => {
    expect(
      parseEnv(serverSchema, { NODE_ENV: "test", DATABASE_DRIVER: "postgres" }).DATABASE_DRIVER,
    ).toBe("postgres");
    expect(
      parseEnv(serverSchema, { NODE_ENV: "test", DATABASE_DRIVER: "neon" }).DATABASE_DRIVER,
    ).toBe("neon");
  });

  it("rejects a DATABASE_DRIVER value outside the strict enum", () => {
    expect(() => parseEnv(serverSchema, { NODE_ENV: "test", DATABASE_DRIVER: "sqlite" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
