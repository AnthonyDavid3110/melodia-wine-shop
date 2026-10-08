import { beforeEach, describe, expect, it } from "vitest";
import {
  fakeStorageProvider,
  getFakeUploadedImages,
  resetFakeUploadedImages,
} from "./fake-test-provider";

const INPUT = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  pathname: "bundles/22222222-2222-4222-8222-222222222222.png",
  contentType: "image/png" as const,
};

beforeEach(() => {
  resetFakeUploadedImages();
});

describe("fakeStorageProvider", () => {
  it("returns a deterministic fake URL derived from the pathname, never a real Blob host", async () => {
    const result = await fakeStorageProvider.uploadImage(INPUT);
    expect(result.url).toBe(`https://fake-blob.test/${INPUT.pathname}`);
  });

  it("records the upload for later test inspection", async () => {
    await fakeStorageProvider.uploadImage(INPUT);

    const uploaded = getFakeUploadedImages();
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatchObject({
      pathname: INPUT.pathname,
      contentType: INPUT.contentType,
      byteLength: INPUT.bytes.byteLength,
      url: `https://fake-blob.test/${INPUT.pathname}`,
    });
  });

  it("resetFakeUploadedImages() clears recorded uploads", async () => {
    await fakeStorageProvider.uploadImage(INPUT);
    resetFakeUploadedImages();
    expect(getFakeUploadedImages()).toHaveLength(0);
  });

  it("never throws — always succeeds, no network", async () => {
    await expect(fakeStorageProvider.uploadImage(INPUT)).resolves.toBeDefined();
  });
});
