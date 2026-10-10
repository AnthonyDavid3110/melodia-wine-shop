import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fully isolated Server Action orchestration tests (Phase 15, Gate
 * ARCH-006-D) — every external boundary (auth, database, storage,
 * image validation, Next's `redirect`/`revalidatePath`) is mocked, so
 * this exercises only `actions.ts`'s own ordering/error-handling logic:
 * requireAdmin() first, image validation/upload BEFORE any database
 * write, and a forged `imageUrl` FormData field having no effect at
 * all. No real database, no real Blob upload, no real Next.js runtime
 * — end-to-end coverage against the real stack lives in the Playwright
 * suite instead (`e2e/admin-catalog.spec.ts`), matching this
 * codebase's existing convention of using E2E, not unit mocks, for
 * full-stack admin-mutation coverage.
 */

/**
 * `products.ts` imports `db` from `../database/client` as a VALUE
 * (used as every function's default `dbHandle` parameter) — unlike a
 * type-only import, this triggers `client.ts`'s unconditional
 * module-load-time `DATABASE_URL` assertion the moment `products.ts`
 * loads, including transitively via this file's own
 * `importOriginal()` calls below. This mock exists solely to let the
 * module graph load in a DB-less unit-test process — every DB-touching
 * function from `products.ts` is itself mocked below and never
 * dereferences the real `db`. Same precedent as
 * `src/infrastructure/payments/online-payments.test.ts`.
 */
vi.mock("@/infrastructure/database/client", () => ({ db: {} }));

const mockRequireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: mockRequireAdmin }));

const mockCreateProduct = vi.hoisted(() => vi.fn());
const mockUpdateProduct = vi.hoisted(() => vi.fn());
const mockGetProduct = vi.hoisted(() => vi.fn());
const mockProductSlugExists = vi.hoisted(() => vi.fn());
const mockSetProductImage = vi.hoisted(() => vi.fn());
const mockSetProductActive = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/products/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/products/products")>();
  return {
    ...actual,
    createProduct: mockCreateProduct,
    updateProduct: mockUpdateProduct,
    getProduct: mockGetProduct,
    productSlugExists: mockProductSlugExists,
    setProductImage: mockSetProductImage,
    setProductActive: mockSetProductActive,
  };
});

const mockGenerateImagePathname = vi.hoisted(() => vi.fn());
const mockUploadImage = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/storage/upload-image", () => ({
  generateImagePathname: mockGenerateImagePathname,
  uploadImage: mockUploadImage,
}));

const mockValidateAndNormalizeImage = vi.hoisted(() => vi.fn());
vi.mock("@/domain/products/validate-image-upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/products/validate-image-upload")>();
  return {
    ...actual,
    validateAndNormalizeImage: mockValidateAndNormalizeImage,
  };
});

const mockRedirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

const mockRevalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const { createProductAction, updateProductAction, removeProductImageAction } =
  await import("./actions");
const { ProductNotFoundError, DuplicateProductSlugError } =
  await import("@/infrastructure/products/products");
const { ImageValidationError } = await import("@/domain/products/validate-image-upload");

const ADMIN = { adminId: "admin-1", authUserId: "auth-1", email: "a@b.ch", name: "Admin" };

function baseFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Chasselas");
  fd.set("category", "WHITE");
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(ADMIN);
  mockProductSlugExists.mockResolvedValue(false);
});

describe("createProductAction", () => {
  it("rejects when unauthorized, before touching any upload or database function", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(createProductAction({}, baseFormData())).rejects.toThrow("unauthorized");

    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("a forged `imageUrl` FormData field has no effect — the schema has no such key", async () => {
    mockCreateProduct.mockResolvedValue({ id: "new-id" });

    const fd = baseFormData({ imageUrl: "https://evil.example.com/pwned.jpg" });
    await createProductAction({}, fd);

    expect(mockCreateProduct).toHaveBeenCalledTimes(1);
    const input = mockCreateProduct.mock.calls[0]![0];
    expect(input.imageUrl).toBeNull();
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
  });

  it("creates a product with imageUrl = null when no image file is supplied", async () => {
    mockCreateProduct.mockResolvedValue({ id: "new-id" });

    await createProductAction({}, baseFormData());

    expect(mockCreateProduct).toHaveBeenCalledTimes(1);
    expect(mockCreateProduct.mock.calls[0]![0].imageUrl).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/produits/new-id");
  });

  it("validates and uploads a supplied image BEFORE writing to the database, and persists the resulting URL", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("products/some-uuid.jpg");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/products/some-uuid.jpg" });
    mockCreateProduct.mockResolvedValue({ id: "new-id" });

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.jpg", { type: "image/jpeg" }));

    await createProductAction({}, fd);

    const uploadOrder = mockUploadImage.mock.invocationCallOrder[0]!;
    const createOrder = mockCreateProduct.mock.invocationCallOrder[0]!;
    expect(uploadOrder).toBeLessThan(createOrder);

    expect(mockCreateProduct.mock.calls[0]![0].imageUrl).toBe(
      "https://blob.example.com/products/some-uuid.jpg",
    );
  });

  it("image validation failure prevents both upload and database write", async () => {
    mockValidateAndNormalizeImage.mockRejectedValue(
      new ImageValidationError("Le fichier n'est pas une image valide."),
    );

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.jpg", { type: "image/jpeg" }));

    const result = await createProductAction({}, fd);

    expect(result.formError).toBe("Le fichier n'est pas une image valide.");
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("upload failure prevents the database write and returns a safe, generic error (no SDK details)", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("products/some-uuid.jpg");
    mockUploadImage.mockRejectedValue(new Error("some internal Blob SDK detail, never shown"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.jpg", { type: "image/jpeg" }));

    const result = await createProductAction({}, fd);

    expect(result.formError).toBeDefined();
    expect(result.formError).not.toContain("internal Blob SDK detail");
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("a database failure after a successful upload returns a safe error without crashing", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("products/some-uuid.jpg");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/products/some-uuid.jpg" });
    mockCreateProduct.mockRejectedValue(new Error("connection reset"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.jpg", { type: "image/jpeg" }));

    await expect(createProductAction({}, fd)).rejects.toThrow("connection reset");
    // The upload already happened — this is the accepted, documented
    // orphaned-Blob outcome (Gate ARCH-006-A), not a crash or a silent
    // double-write.
    expect(mockUploadImage).toHaveBeenCalledTimes(1);
  });

  it("a concurrent duplicate-slug race returns a clear French error, not a crash", async () => {
    mockCreateProduct.mockRejectedValue(new DuplicateProductSlugError("chasselas"));

    const result = await createProductAction({}, baseFormData());

    expect(result.formError).toContain("vient d'être créé");
  });
});

describe("updateProductAction", () => {
  it("rejects when unauthorized, before touching any upload or database function", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(updateProductAction("p1", {}, baseFormData())).rejects.toThrow("unauthorized");
    expect(mockGetProduct).not.toHaveBeenCalled();
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });

  it("omits imageUrl entirely from the update when no new file is supplied — not merely preserves its value (Gate ARCH-006-D concurrency fix)", async () => {
    mockGetProduct.mockResolvedValue({
      id: "p1",
      slug: "chasselas",
      imageUrl: "https://blob.example.com/products/existing.jpg",
    });
    mockUpdateProduct.mockResolvedValue({ id: "p1" });

    await updateProductAction("p1", {}, baseFormData());

    expect(mockUpdateProduct).toHaveBeenCalledTimes(1);
    // getProduct is only called once (the not-found check) — no extra
    // pre-write re-fetch exists anymore, because none is needed: the
    // column is excluded from the SQL UPDATE, not merely re-read.
    expect(mockGetProduct).toHaveBeenCalledTimes(1);
    const input = mockUpdateProduct.mock.calls[0]![1];
    expect("imageUrl" in input).toBe(false);
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
  });

  it("a forged `imageUrl` FormData field still has no effect when omitting the column", async () => {
    mockGetProduct.mockResolvedValue({
      id: "p1",
      slug: "chasselas",
      imageUrl: "https://blob.example.com/products/existing.jpg",
    });
    mockUpdateProduct.mockResolvedValue({ id: "p1" });

    const fd = baseFormData({ imageUrl: "https://evil.example.com/pwned.jpg" });
    await updateProductAction("p1", {}, fd);

    const input = mockUpdateProduct.mock.calls[0]![1];
    expect("imageUrl" in input).toBe(false);
  });

  it("replaces the existing imageUrl when a new valid file is supplied", async () => {
    mockGetProduct.mockResolvedValue({
      id: "p1",
      slug: "chasselas",
      imageUrl: "https://blob.example.com/products/old.jpg",
    });
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    mockGenerateImagePathname.mockReturnValue("products/new-uuid.png");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/products/new-uuid.png" });
    mockUpdateProduct.mockResolvedValue({ id: "p1" });

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.png", { type: "image/png" }));

    await updateProductAction("p1", {}, fd);

    expect(mockUpdateProduct.mock.calls[0]![1].imageUrl).toBe(
      "https://blob.example.com/products/new-uuid.png",
    );
  });

  it("upload failure on replacement preserves the existing image (never writes before upload succeeds)", async () => {
    mockGetProduct.mockResolvedValue({
      id: "p1",
      slug: "chasselas",
      imageUrl: "https://blob.example.com/products/existing.jpg",
    });
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    mockGenerateImagePathname.mockReturnValue("products/new-uuid.png");
    mockUploadImage.mockRejectedValue(new Error("network failure"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "wine.png", { type: "image/png" }));

    const result = await updateProductAction("p1", {}, fd);

    expect(result.formError).toBeDefined();
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });
});

describe("removeProductImageAction", () => {
  it("rejects when unauthorized, before touching the database", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(removeProductImageAction("p1", {}, new FormData())).rejects.toThrow(
      "unauthorized",
    );
    expect(mockSetProductImage).not.toHaveBeenCalled();
  });

  it("clears imageUrl to null and never calls a Blob-deletion capability", async () => {
    mockSetProductImage.mockResolvedValue({ id: "p1", imageUrl: null });

    const result = await removeProductImageAction("p1", {}, new FormData());

    expect(mockSetProductImage).toHaveBeenCalledWith("p1", null);
    expect(result.formError).toBeUndefined();
    // The storage module exposes no delete capability at all (Gate B) —
    // nothing here could call one even by mistake.
  });

  it("a not-found product returns a clear error rather than crashing", async () => {
    mockSetProductImage.mockRejectedValue(new ProductNotFoundError("missing-id"));

    const result = await removeProductImageAction("missing-id", {}, new FormData());

    expect(result.formError).toContain("introuvable");
  });
});
