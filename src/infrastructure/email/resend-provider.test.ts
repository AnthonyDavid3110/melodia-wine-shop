import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerEnv = vi.hoisted(() => ({
  RESEND_API_KEY: "test-resend-key" as string | undefined,
  EMAIL_FROM: "Les Vins de Mélodia <test@example.test>" as string | undefined,
}));
vi.mock("@/lib/env", () => ({ serverEnv: mockServerEnv }));

const mockSend = vi.hoisted(() => vi.fn());
// `new Resend(...)` requires the mock implementation itself to be
// constructible — an arrow function has no [[Construct]] and throws
// "is not a constructor" under `vi.fn().mockImplementation(...)`, so a
// plain function expression is required here.
const mockResendConstructor = vi.hoisted(() =>
  vi.fn(function MockResend() {
    return { emails: { send: mockSend } };
  }),
);
vi.mock("resend", () => ({ Resend: mockResendConstructor }));

const {
  sendEmail,
  isResendConfigured,
  EmailConfigurationError,
  EmailProviderRejectedError,
  EmailNetworkError,
} = await import("./resend-provider");

const INPUT = {
  to: "jean@example.ch",
  subject: "Commande ECM-2026-0042 confirmée — Les Vins de Mélodia",
  html: "<p>Bonjour</p>",
  text: "Bonjour",
};

beforeEach(() => {
  mockServerEnv.RESEND_API_KEY = "test-resend-key";
  mockServerEnv.EMAIL_FROM = "Les Vins de Mélodia <test@example.test>";
  mockSend.mockReset();
  mockResendConstructor.mockClear();
});

describe("isResendConfigured", () => {
  it("is true when both variables are set", () => {
    expect(isResendConfigured()).toBe(true);
  });

  it("is false when RESEND_API_KEY is missing", () => {
    mockServerEnv.RESEND_API_KEY = undefined;
    expect(isResendConfigured()).toBe(false);
  });

  it("is false when EMAIL_FROM is missing", () => {
    mockServerEnv.EMAIL_FROM = undefined;
    expect(isResendConfigured()).toBe(false);
  });
});

describe("configuration", () => {
  it("throws EmailConfigurationError and never calls the SDK when RESEND_API_KEY is missing", async () => {
    mockServerEnv.RESEND_API_KEY = undefined;
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailConfigurationError);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("throws EmailConfigurationError and never calls the SDK when EMAIL_FROM is missing", async () => {
    mockServerEnv.EMAIL_FROM = undefined;
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailConfigurationError);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("the configuration error message never contains the API key value", async () => {
    mockServerEnv.RESEND_API_KEY = undefined;
    try {
      await sendEmail(INPUT);
      throw new Error("expected sendEmail to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain("test-resend-key");
    }
  });
});

describe("sendEmail — request shape", () => {
  it("sends the correct sender, recipient, subject, html and text", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    await sendEmail(INPUT);
    expect(mockSend).toHaveBeenCalledWith({
      from: "Les Vins de Mélodia <test@example.test>",
      to: "jean@example.ch",
      subject: INPUT.subject,
      html: INPUT.html,
      text: INPUT.text,
    });
  });

  it("constructs the Resend client with the configured API key", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    await sendEmail(INPUT);
    expect(mockResendConstructor).toHaveBeenCalledWith("test-resend-key");
  });
});

describe("sendEmail — success normalization", () => {
  it("returns the provider message ID on success", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    const result = await sendEmail(INPUT);
    expect(result).toEqual({ messageId: "msg-123" });
  });
});

describe("sendEmail — provider rejection normalization", () => {
  it("normalizes a validation_error into EmailProviderRejectedError with the provider error name", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid `to` field.", name: "validation_error", statusCode: 422 },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailProviderRejectedError);
    try {
      await sendEmail(INPUT);
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderRejectedError);
      expect((error as InstanceType<typeof EmailProviderRejectedError>).providerErrorName).toBe(
        "validation_error",
      );
    }
  });

  it("normalizes a quota-exceeded rejection into EmailProviderRejectedError, not EmailNetworkError", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        message: "Monthly quota exceeded.",
        name: "monthly_quota_exceeded",
        statusCode: 429,
      },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailProviderRejectedError);
  });
});

describe("sendEmail — configuration errors surfaced by Resend itself", () => {
  it("normalizes missing_api_key into EmailConfigurationError", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Missing API key.", name: "missing_api_key", statusCode: 401 },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailConfigurationError);
  });

  it("normalizes invalid_from_address into EmailConfigurationError", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid from address.", name: "invalid_from_address", statusCode: 422 },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailConfigurationError);
  });
});

describe("sendEmail — network/transient normalization", () => {
  it("normalizes rate_limit_exceeded into EmailNetworkError", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded.", name: "rate_limit_exceeded", statusCode: 429 },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailNetworkError);
  });

  it("normalizes internal_server_error into EmailNetworkError", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Unexpected.", name: "internal_server_error", statusCode: 500 },
    });
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailNetworkError);
  });

  it("normalizes a thrown network/connection failure into EmailNetworkError", async () => {
    mockSend.mockRejectedValue(new TypeError("fetch failed"));
    await expect(sendEmail(INPUT)).rejects.toThrow(EmailNetworkError);
  });

  it("the network error message never leaks the raw thrown error", async () => {
    mockSend.mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED 10.0.0.1:443"));
    try {
      await sendEmail(INPUT);
      throw new Error("expected sendEmail to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain("ECONNREFUSED");
      expect((error as Error).message).not.toContain("10.0.0.1");
    }
  });
});
