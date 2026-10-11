import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fully isolated Server Action orchestration tests (Phase 15, Gate
 * ARCH-006-E) — every external boundary (auth, database, storage,
 * image validation, Next's `redirect`/`revalidatePath`) is mocked, so
 * this exercises only `actions.ts`'s own ordering/error-handling logic:
 * requireAdmin() first, image validation/upload BEFORE any database
 * write, a forged `imageUrl` FormData field having no effect at all,
 * and campaign-ownership verification. No real database, no real Blob
 * upload, no real Next.js runtime — end-to-end coverage against the
 * real stack lives in the Playwright suite instead
 * (`e2e/bundle-image-upload.spec.ts`), matching this codebase's
 * existing convention and mirroring `produits/actions.test.ts` (Gate
 * ARCH-006-D) exactly, adapted for bundles' campaign scoping.
 */

/**
 * `bundles.ts` imports `db` from `../database/client` as a VALUE —
 * unlike a type-only import, this triggers `client.ts`'s unconditional
 * module-load-time `DATABASE_URL` assertion the moment `bundles.ts`
 * loads, including transitively via this file's own
 * `importOriginal()` calls below. This mock exists solely to let the
 * module graph load in a DB-less unit-test process — every DB-touching
 * function from `bundles.ts` is itself mocked below and never
 * dereferences the real `db`. Same precedent as
 * `produits/actions.test.ts`.
 */
vi.mock("@/infrastructure/database/client", () => ({ db: {} }));

const mockRequireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: mockRequireAdmin }));

const mockCreateBundle = vi.hoisted(() => vi.fn());
const mockUpdateBundleFields = vi.hoisted(() => vi.fn());
const mockGetBundle = vi.hoisted(() => vi.fn());
const mockBundleSlugExists = vi.hoisted(() => vi.fn());
const mockSetBundleImage = vi.hoisted(() => vi.fn());
const mockSetBundleActive = vi.hoisted(() => vi.fn());
const mockReplaceBundleComposition = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/campaign/bundles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/campaign/bundles")>();
  return {
    ...actual,
    createBundle: mockCreateBundle,
    updateBundleFields: mockUpdateBundleFields,
    getBundle: mockGetBundle,
    bundleSlugExists: mockBundleSlugExists,
    setBundleImage: mockSetBundleImage,
    setBundleActive: mockSetBundleActive,
    replaceBundleComposition: mockReplaceBundleComposition,
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

const { createBundleAction, updateBundleAction, removeBundleImageAction, setBundleActiveAction } =
  await import("./actions");
const { BundleNotFoundError, DuplicateBundleSlugError } =
  await import("@/infrastructure/campaign/bundles");
const { ImageValidationError } = await import("@/domain/products/validate-image-upload");

const ADMIN = { adminId: "admin-1", authUserId: "auth-1", email: "a@b.ch", name: "Admin" };
const CAMPAIGN_ID = "campaign-1";
const OTHER_CAMPAIGN_ID = "campaign-2";
const BUNDLE_ID = "bundle-1";

function baseFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Carton découverte");
  fd.set("price", "120");
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(ADMIN);
  mockBundleSlugExists.mockResolvedValue(false);
});

describe("createBundleAction", () => {
  it("rejects when unauthorized, before touching any upload or database function", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(createBundleAction(CAMPAIGN_ID, {}, baseFormData())).rejects.toThrow(
      "unauthorized",
    );

    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateBundle).not.toHaveBeenCalled();
  });

  it("a forged `imageUrl` FormData field has no effect — the schema has no such key", async () => {
    mockCreateBundle.mockResolvedValue({ id: "new-id" });

    const fd = baseFormData({ imageUrl: "https://evil.example.com/pwned.jpg" });
    await createBundleAction(CAMPAIGN_ID, {}, fd);

    expect(mockCreateBundle).toHaveBeenCalledTimes(1);
    const input = mockCreateBundle.mock.calls[0]![1];
    expect(input.imageUrl).toBeNull();
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
  });

  it("creates a bundle with imageUrl = null when no image file is supplied", async () => {
    mockCreateBundle.mockResolvedValue({ id: "new-id" });

    await createBundleAction(CAMPAIGN_ID, {}, baseFormData());

    expect(mockCreateBundle).toHaveBeenCalledTimes(1);
    expect(mockCreateBundle.mock.calls[0]![0]).toBe(CAMPAIGN_ID);
    expect(mockCreateBundle.mock.calls[0]![1].imageUrl).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith(`/admin/campagne/${CAMPAIGN_ID}/bundles/new-id`);
  });

  it("validates and uploads a supplied image under the bundles/ pathname kind BEFORE writing to the database", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("bundles/some-uuid.jpg");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/bundles/some-uuid.jpg" });
    mockCreateBundle.mockResolvedValue({ id: "new-id" });

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.jpg", { type: "image/jpeg" }));

    await createBundleAction(CAMPAIGN_ID, {}, fd);

    expect(mockGenerateImagePathname).toHaveBeenCalledWith("bundles", "image/jpeg");

    const uploadOrder = mockUploadImage.mock.invocationCallOrder[0]!;
    const createOrder = mockCreateBundle.mock.invocationCallOrder[0]!;
    expect(uploadOrder).toBeLessThan(createOrder);

    expect(mockCreateBundle.mock.calls[0]![1].imageUrl).toBe(
      "https://blob.example.com/bundles/some-uuid.jpg",
    );
  });

  it("image validation failure prevents both upload and database write", async () => {
    mockValidateAndNormalizeImage.mockRejectedValue(
      new ImageValidationError("Le fichier n'est pas une image valide."),
    );

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.jpg", { type: "image/jpeg" }));

    const result = await createBundleAction(CAMPAIGN_ID, {}, fd);

    expect(result.formError).toBe("Le fichier n'est pas une image valide.");
    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockCreateBundle).not.toHaveBeenCalled();
  });

  it("upload failure prevents the database write and returns a safe, generic error (no SDK details)", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("bundles/some-uuid.jpg");
    mockUploadImage.mockRejectedValue(new Error("some internal Blob SDK detail, never shown"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.jpg", { type: "image/jpeg" }));

    const result = await createBundleAction(CAMPAIGN_ID, {}, fd);

    expect(result.formError).toBeDefined();
    expect(result.formError).not.toContain("internal Blob SDK detail");
    expect(mockCreateBundle).not.toHaveBeenCalled();
  });

  it("a database failure after a successful upload returns a safe error without crashing", async () => {
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    mockGenerateImagePathname.mockReturnValue("bundles/some-uuid.jpg");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/bundles/some-uuid.jpg" });
    mockCreateBundle.mockRejectedValue(new Error("connection reset"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.jpg", { type: "image/jpeg" }));

    await expect(createBundleAction(CAMPAIGN_ID, {}, fd)).rejects.toThrow("connection reset");
    // The upload already happened — this is the accepted, documented
    // orphaned-Blob outcome (Gate ARCH-006-A), not a crash or a silent
    // double-write.
    expect(mockUploadImage).toHaveBeenCalledTimes(1);
  });

  it("a concurrent duplicate-slug race returns a clear French error, not a crash", async () => {
    mockCreateBundle.mockRejectedValue(new DuplicateBundleSlugError("carton-decouverte"));

    const result = await createBundleAction(CAMPAIGN_ID, {}, baseFormData());

    expect(result.formError).toContain("vient d'être créé");
  });
});

describe("updateBundleAction", () => {
  it("rejects when unauthorized, before touching any upload or database function", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, baseFormData())).rejects.toThrow(
      "unauthorized",
    );
    expect(mockGetBundle).not.toHaveBeenCalled();
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
    expect(mockUpdateBundleFields).not.toHaveBeenCalled();
  });

  it("rejects a bundle belonging to a different campaign, reported identically to not-found", async () => {
    mockGetBundle.mockResolvedValue({
      id: BUNDLE_ID,
      campaignId: OTHER_CAMPAIGN_ID,
      slug: "carton-decouverte",
      imageUrl: null,
    });

    const result = await updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, baseFormData());

    expect(result.formError).toContain("introuvable");
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
    expect(mockUpdateBundleFields).not.toHaveBeenCalled();
  });

  it("omits imageUrl entirely from the update when no new file is supplied — not merely preserves its value", async () => {
    mockGetBundle.mockResolvedValue({
      id: BUNDLE_ID,
      campaignId: CAMPAIGN_ID,
      slug: "carton-decouverte",
      imageUrl: "https://blob.example.com/bundles/existing.jpg",
    });
    mockUpdateBundleFields.mockResolvedValue({ id: BUNDLE_ID });

    await updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, baseFormData());

    expect(mockUpdateBundleFields).toHaveBeenCalledTimes(1);
    // getBundle is only called once (the ownership/not-found check) —
    // no extra pre-write re-fetch exists, because none is needed: the
    // column is excluded from the SQL UPDATE, not merely re-read.
    expect(mockGetBundle).toHaveBeenCalledTimes(1);
    const input = mockUpdateBundleFields.mock.calls[0]![1];
    expect("imageUrl" in input).toBe(false);
    expect(mockValidateAndNormalizeImage).not.toHaveBeenCalled();
  });

  it("a forged `imageUrl` FormData field still has no effect when omitting the column", async () => {
    mockGetBundle.mockResolvedValue({
      id: BUNDLE_ID,
      campaignId: CAMPAIGN_ID,
      slug: "carton-decouverte",
      imageUrl: "https://blob.example.com/bundles/existing.jpg",
    });
    mockUpdateBundleFields.mockResolvedValue({ id: BUNDLE_ID });

    const fd = baseFormData({ imageUrl: "https://evil.example.com/pwned.jpg" });
    await updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, fd);

    const input = mockUpdateBundleFields.mock.calls[0]![1];
    expect("imageUrl" in input).toBe(false);
  });

  it("replaces the existing imageUrl when a new valid file is supplied", async () => {
    mockGetBundle.mockResolvedValue({
      id: BUNDLE_ID,
      campaignId: CAMPAIGN_ID,
      slug: "carton-decouverte",
      imageUrl: "https://blob.example.com/bundles/old.jpg",
    });
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    mockGenerateImagePathname.mockReturnValue("bundles/new-uuid.png");
    mockUploadImage.mockResolvedValue({ url: "https://blob.example.com/bundles/new-uuid.png" });
    mockUpdateBundleFields.mockResolvedValue({ id: BUNDLE_ID });

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.png", { type: "image/png" }));

    await updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, fd);

    expect(mockUpdateBundleFields.mock.calls[0]![1].imageUrl).toBe(
      "https://blob.example.com/bundles/new-uuid.png",
    );
  });

  it("upload failure on replacement preserves the existing image (never writes before upload succeeds)", async () => {
    mockGetBundle.mockResolvedValue({
      id: BUNDLE_ID,
      campaignId: CAMPAIGN_ID,
      slug: "carton-decouverte",
      imageUrl: "https://blob.example.com/bundles/existing.jpg",
    });
    mockValidateAndNormalizeImage.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    mockGenerateImagePathname.mockReturnValue("bundles/new-uuid.png");
    mockUploadImage.mockRejectedValue(new Error("network failure"));

    const fd = baseFormData();
    fd.set("image", new File([new Uint8Array([1, 2, 3])], "carton.png", { type: "image/png" }));

    const result = await updateBundleAction(CAMPAIGN_ID, BUNDLE_ID, {}, fd);

    expect(result.formError).toBeDefined();
    expect(mockUpdateBundleFields).not.toHaveBeenCalled();
  });
});

describe("setBundleActiveAction (Gate ARCH-006-E final security fix)", () => {
  it("rejects when unauthorized, before touching the database", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(setBundleActiveAction(CAMPAIGN_ID, BUNDLE_ID, false)).rejects.toThrow(
      "unauthorized",
    );
    expect(mockSetBundleActive).not.toHaveBeenCalled();
  });

  it("passes campaignId through to setBundleActive for server-side ownership enforcement", async () => {
    mockSetBundleActive.mockResolvedValue({ id: BUNDLE_ID, active: false });

    await setBundleActiveAction(CAMPAIGN_ID, BUNDLE_ID, false);

    expect(mockSetBundleActive).toHaveBeenCalledWith(BUNDLE_ID, CAMPAIGN_ID, false);
  });

  it("a wrong-campaign bundle rejects rather than silently toggling it, reported identically to not-found", async () => {
    mockSetBundleActive.mockRejectedValue(new BundleNotFoundError(BUNDLE_ID));

    await expect(setBundleActiveAction(CAMPAIGN_ID, BUNDLE_ID, false)).rejects.toThrow(
      "introuvable",
    );
  });
});

describe("removeBundleImageAction", () => {
  it("rejects when unauthorized, before touching the database", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(
      removeBundleImageAction(CAMPAIGN_ID, BUNDLE_ID, {}, new FormData()),
    ).rejects.toThrow("unauthorized");
    expect(mockSetBundleImage).not.toHaveBeenCalled();
  });

  it("clears imageUrl to null, scoped to the given campaign, and never calls a Blob-deletion capability", async () => {
    mockSetBundleImage.mockResolvedValue({ id: BUNDLE_ID, imageUrl: null });

    const result = await removeBundleImageAction(CAMPAIGN_ID, BUNDLE_ID, {}, new FormData());

    expect(mockSetBundleImage).toHaveBeenCalledWith(BUNDLE_ID, CAMPAIGN_ID, null);
    expect(result.formError).toBeUndefined();
    // The storage module exposes no delete capability at all (Gate B) —
    // nothing here could call one even by mistake.
  });

  it("a not-found/wrong-campaign bundle returns a clear error rather than crashing", async () => {
    mockSetBundleImage.mockRejectedValue(new BundleNotFoundError(BUNDLE_ID));

    const result = await removeBundleImageAction(CAMPAIGN_ID, BUNDLE_ID, {}, new FormData());

    expect(result.formError).toContain("introuvable");
  });
});
