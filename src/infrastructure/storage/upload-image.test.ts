import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRealUpload = vi.hoisted(() => vi.fn());
vi.mock("./vercel-blob-provider", () => ({
  vercelBlobProvider: { uploadImage: mockRealUpload },
  isBlobStorageConfigured: () => true,
}));

const { uploadImage, generateImagePathname, isImageUploadAvailable, InvalidStoragePathError } =
  await import("./upload-image");
const { getFakeUploadedImages, resetFakeUploadedImages } = await import("./fake-test-provider");

const VALID_INPUT = {
  bytes: new Uint8Array([1, 2, 3]),
  pathname: "products/11111111-1111-4111-8111-111111111111.jpg",
  contentType: "image/jpeg" as const,
};

const originalNodeEnv = process.env.NODE_ENV;
const originalOptIn = process.env.E2E_FAKE_STORAGE_PROVIDER;

beforeEach(() => {
  mockRealUpload.mockReset();
  mockRealUpload.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/x.jpg" });
  resetFakeUploadedImages();
});

afterEach(() => {
  vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
  if (originalOptIn === undefined) {
    delete process.env.E2E_FAKE_STORAGE_PROVIDER;
  } else {
    process.env.E2E_FAKE_STORAGE_PROVIDER = originalOptIn;
  }
  vi.unstubAllEnvs();
});

describe("generateImagePathname", () => {
  it("produces a pathname that uploadImage accepts, for every kind/contentType combination", async () => {
    const kinds = ["products", "bundles"] as const;
    const contentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

    for (const kind of kinds) {
      for (const contentType of contentTypes) {
        const pathname = generateImagePathname(kind, contentType);
        expect(pathname).toMatch(new RegExp(`^${kind}/[0-9a-f-]{36}\\.(jpg|png|webp)$`));
        await expect(
          uploadImage({ bytes: VALID_INPUT.bytes, pathname, contentType }),
        ).resolves.toBeDefined();
      }
    }
  });
});

describe("uploadImage — controlled pathname validation", () => {
  const invalidPathnames = [
    "../../etc/passwd",
    "products/not-a-uuid.jpg",
    "products/11111111-1111-4111-8111-111111111111.svg",
    "random-kind/11111111-1111-4111-8111-111111111111.jpg",
    "products/11111111-1111-4111-8111-111111111111.jpg/../../escape",
    "",
  ];

  it.each(invalidPathnames)("rejects %s without ever calling a provider", async (pathname) => {
    await expect(uploadImage({ ...VALID_INPUT, pathname })).rejects.toThrow(
      InvalidStoragePathError,
    );
    expect(mockRealUpload).not.toHaveBeenCalled();
    expect(getFakeUploadedImages()).toHaveLength(0);
  });

  it("rejects a well-formed pathname whose extension does not match the declared contentType (Gate ARCH-006-B review finding)", async () => {
    // A valid `products/<uuid>.jpg` pathname, but declared as PNG — the
    // shape check alone would accept this; the extension/contentType
    // consistency check must still reject it.
    const mismatched = {
      ...VALID_INPUT,
      pathname: "products/11111111-1111-4111-8111-111111111111.jpg",
      contentType: "image/png" as const,
    };

    await expect(uploadImage(mismatched)).rejects.toThrow(InvalidStoragePathError);
    expect(mockRealUpload).not.toHaveBeenCalled();
    expect(getFakeUploadedImages()).toHaveLength(0);
  });
});

describe("uploadImage — production safety (storage fake-provider guard)", () => {
  it("NEVER uses the fake provider in production, even with the opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.E2E_FAKE_STORAGE_PROVIDER = "true";

    await uploadImage(VALID_INPUT);

    expect(mockRealUpload).toHaveBeenCalledTimes(1);
    expect(getFakeUploadedImages()).toHaveLength(0);
  });
});

describe("uploadImage — provider selection", () => {
  it("uses the fake provider when NODE_ENV is not production AND the opt-in is set", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.E2E_FAKE_STORAGE_PROVIDER = "true";

    await uploadImage(VALID_INPUT);

    expect(mockRealUpload).not.toHaveBeenCalled();
    expect(getFakeUploadedImages()).toHaveLength(1);
  });

  it("uses the real provider when the opt-in is not set, regardless of NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.E2E_FAKE_STORAGE_PROVIDER;

    await uploadImage(VALID_INPUT);

    expect(mockRealUpload).toHaveBeenCalledTimes(1);
    expect(getFakeUploadedImages()).toHaveLength(0);
  });
});

describe("isImageUploadAvailable", () => {
  it("reflects the (mocked) storage-configured check", () => {
    expect(isImageUploadAvailable()).toBe(true);
  });
});
