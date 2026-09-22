import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockServerEnv = vi.hoisted(() => ({ APP_BASE_URL: undefined as string | undefined }));
vi.mock("./env", () => ({ serverEnv: mockServerEnv }));

const { appUrl, AppBaseUrlNotConfiguredError } = await import("./app-url");

beforeEach(() => {
  mockServerEnv.APP_BASE_URL = "http://localhost:3000";
});

afterEach(() => {
  mockServerEnv.APP_BASE_URL = undefined;
});

describe("appUrl", () => {
  it("builds an absolute URL from a relative path", () => {
    expect(appUrl("/commande/retour")).toBe("http://localhost:3000/commande/retour");
  });

  it("never produces a double slash, even with a trailing-slash base", () => {
    mockServerEnv.APP_BASE_URL = "http://localhost:3000/";
    expect(appUrl("/commande/retour")).toBe("http://localhost:3000/commande/retour");
  });

  it("appends search parameters", () => {
    expect(appUrl("/commande/retour", { rt: "abc123" })).toBe(
      "http://localhost:3000/commande/retour?rt=abc123",
    );
  });

  it("URL-encodes search parameter values safely", () => {
    const url = appUrl("/commande/retour", { rt: "a b/c" });
    expect(url).toBe("http://localhost:3000/commande/retour?rt=a+b%2Fc");
  });

  it("throws AppBaseUrlNotConfiguredError when APP_BASE_URL is unset", () => {
    mockServerEnv.APP_BASE_URL = undefined;
    expect(() => appUrl("/commande/retour")).toThrow(AppBaseUrlNotConfiguredError);
  });

  it("works with a production https origin", () => {
    mockServerEnv.APP_BASE_URL = "https://vins.ecmelodia.ch";
    expect(appUrl("/api/payments/saferpay/notify/abc")).toBe(
      "https://vins.ecmelodia.ch/api/payments/saferpay/notify/abc",
    );
  });
});
