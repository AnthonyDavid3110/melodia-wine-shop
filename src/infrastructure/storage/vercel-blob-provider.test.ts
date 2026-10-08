import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerEnv = vi.hoisted(() => ({
  BLOB_READ_WRITE_TOKEN: "test-blob-token" as string | undefined,
}));
vi.mock("@/lib/env", () => ({ serverEnv: mockServerEnv }));

const mockPut = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({ put: mockPut }));

const {
  vercelBlobProvider,
  isBlobStorageConfigured,
  StorageConfigurationError,
  StorageNetworkError,
} = await import("./vercel-blob-provider");

const INPUT = {
  bytes: new Uint8Array([1, 2, 3]),
  pathname: "products/11111111-1111-4111-8111-111111111111.jpg",
  contentType: "image/jpeg" as const,
};

beforeEach(() => {
  mockServerEnv.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  mockPut.mockReset();
});

describe("isBlobStorageConfigured", () => {
  it("is true when BLOB_READ_WRITE_TOKEN is set", () => {
    expect(isBlobStorageConfigured()).toBe(true);
  });

  it("is false when BLOB_READ_WRITE_TOKEN is missing", () => {
    mockServerEnv.BLOB_READ_WRITE_TOKEN = undefined;
    expect(isBlobStorageConfigured()).toBe(false);
  });
});

describe("configuration", () => {
  it("throws StorageConfigurationError and never calls the SDK when BLOB_READ_WRITE_TOKEN is missing", async () => {
    mockServerEnv.BLOB_READ_WRITE_TOKEN = undefined;
    await expect(vercelBlobProvider.uploadImage(INPUT)).rejects.toThrow(StorageConfigurationError);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("never leaks the token in the thrown error", async () => {
    mockServerEnv.BLOB_READ_WRITE_TOKEN = undefined;
    try {
      await vercelBlobProvider.uploadImage(INPUT);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("test-blob-token");
    }
  });
});

describe("uploadImage", () => {
  it("calls @vercel/blob put() with public access, the given pathname/contentType, and the server token", async () => {
    mockPut.mockResolvedValue({
      url: "https://example.public.blob.vercel-storage.com/products/x.jpg",
    });

    await vercelBlobProvider.uploadImage(INPUT);

    expect(mockPut).toHaveBeenCalledTimes(1);
    const [pathnameArg, bodyArg, optionsArg] = mockPut.mock.calls[0]!;
    expect(pathnameArg).toBe(INPUT.pathname);
    // The adapter wraps the input bytes in a `Buffer` (the SDK's `PutBody`
    // doesn't accept a plain `Uint8Array`) — same bytes, different wrapper.
    expect(Buffer.isBuffer(bodyArg)).toBe(true);
    expect(Buffer.from(bodyArg).equals(Buffer.from(INPUT.bytes))).toBe(true);
    expect(optionsArg).toEqual({
      access: "public",
      contentType: INPUT.contentType,
      token: "test-blob-token",
      addRandomSuffix: false,
    });
  });

  it("returns the provider's resulting URL", async () => {
    mockPut.mockResolvedValue({
      url: "https://example.public.blob.vercel-storage.com/products/x.jpg",
    });

    const result = await vercelBlobProvider.uploadImage(INPUT);

    expect(result).toEqual({
      url: "https://example.public.blob.vercel-storage.com/products/x.jpg",
    });
  });

  it("wraps a put() failure into StorageNetworkError, never exposing the raw provider error", async () => {
    mockPut.mockRejectedValue(new Error("some internal Blob SDK detail, never shown to the admin"));

    await expect(vercelBlobProvider.uploadImage(INPUT)).rejects.toThrow(StorageNetworkError);
  });

  it("never logs or includes the token in a network-failure error", async () => {
    mockPut.mockRejectedValue(new Error("boom"));
    try {
      await vercelBlobProvider.uploadImage(INPUT);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("test-blob-token");
    }
  });
});
