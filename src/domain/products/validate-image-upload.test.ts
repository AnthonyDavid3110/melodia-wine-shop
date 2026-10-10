import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  ImageValidationError,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  validateAndNormalizeImage,
} from "./validate-image-upload";

/**
 * Every fixture here is generated in-process via `sharp` itself (raw
 * pixel buffers encoded to the target format) — never an external or
 * untrusted file, matching the same technique used to empirically
 * verify sharp's behavior during this gate's preflight.
 */
async function makeImage(
  format: "jpeg" | "png" | "webp" | "avif" | "gif",
  width: number,
  height: number,
): Promise<Buffer> {
  if (format === "gif") {
    // A real, valid, minimal 1x1 GIF — sharp can decode it (format
    // "gif"), which is exactly how its rejection via the allowlist is
    // proven, rather than assuming GIF bytes would simply fail to parse.
    return Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  }
  const raw = Buffer.alloc(width * height * 3, 128);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .toFormat(format)
    .toBuffer();
}

function toFile(bytes: Buffer, name: string, type: string): File {
  // `new Uint8Array(bytes)` copies into a fresh, plain `ArrayBuffer`-backed
  // typed array — `Buffer`'s own `ArrayBufferLike` backing (which also
  // permits `SharedArrayBuffer`) isn't directly assignable to `BlobPart`.
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateAndNormalizeImage — accepted formats", () => {
  it("accepts a valid JPEG and returns image/jpeg", async () => {
    const bytes = await makeImage("jpeg", 10, 10);
    const result = await validateAndNormalizeImage(toFile(bytes, "wine.jpg", "image/jpeg"));
    expect(result.contentType).toBe("image/jpeg");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it("accepts a valid PNG and returns image/png", async () => {
    const bytes = await makeImage("png", 10, 10);
    const result = await validateAndNormalizeImage(toFile(bytes, "wine.png", "image/png"));
    expect(result.contentType).toBe("image/png");
  });

  it("accepts a valid WebP and returns image/webp", async () => {
    const bytes = await makeImage("webp", 10, 10);
    const result = await validateAndNormalizeImage(toFile(bytes, "wine.webp", "image/webp"));
    expect(result.contentType).toBe("image/webp");
  });

  it("the normalized output is itself a valid, re-decodable image", async () => {
    const bytes = await makeImage("png", 12, 8);
    const result = await validateAndNormalizeImage(toFile(bytes, "wine.png", "image/png"));
    const redecoded = await sharp(Buffer.from(result.bytes)).metadata();
    expect(redecoded.format).toBe("png");
    expect(redecoded.width).toBe(12);
    expect(redecoded.height).toBe(8);
  });
});

describe("validateAndNormalizeImage — rejected inputs", () => {
  it("rejects an empty file", async () => {
    await expect(
      validateAndNormalizeImage(toFile(Buffer.alloc(0), "empty.jpg", "image/jpeg")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("rejects an oversized file WITHOUT reading its contents (size check happens first)", async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
    const file = toFile(oversized, "huge.jpg", "image/jpeg");
    const arrayBufferSpy = vi.spyOn(file, "arrayBuffer");

    await expect(validateAndNormalizeImage(file)).rejects.toThrow(ImageValidationError);
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it("rejects garbage bytes that are not an image at all", async () => {
    const garbage = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    await expect(
      validateAndNormalizeImage(toFile(garbage, "fake.jpg", "image/jpeg")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("rejects a truncated/corrupt JPEG (valid header, corrupted body)", async () => {
    const good = await makeImage("jpeg", 64, 64);
    const corrupted = Buffer.from(good);
    for (let i = Math.floor(corrupted.length * 0.4); i < Math.floor(corrupted.length * 0.6); i++) {
      corrupted[i] = 0;
    }
    await expect(
      validateAndNormalizeImage(toFile(corrupted, "corrupt.jpg", "image/jpeg")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("rejects SVG", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    );
    await expect(
      validateAndNormalizeImage(toFile(svg, "image.svg", "image/svg+xml")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("rejects GIF even though sharp can decode it", async () => {
    const gif = await makeImage("gif", 1, 1);
    await expect(validateAndNormalizeImage(toFile(gif, "image.gif", "image/gif"))).rejects.toThrow(
      ImageValidationError,
    );
  });

  it("rejects AVIF/HEIF", async () => {
    const avif = await makeImage("avif", 10, 10);
    await expect(
      validateAndNormalizeImage(toFile(avif, "image.avif", "image/avif")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("rejects an image exceeding the maximum dimension", async () => {
    // A thin strip is cheap to encode but still exceeds the 8000px cap on one axis.
    const tooWide = await makeImage("png", MAX_IMAGE_DIMENSION + 1, 1);
    await expect(
      validateAndNormalizeImage(toFile(tooWide, "wide.png", "image/png")),
    ).rejects.toThrow(ImageValidationError);
  });

  it("MIME spoofing: a real JPEG labeled as image/png is still validated by its DECODED format, not File.type", async () => {
    const realJpeg = await makeImage("jpeg", 10, 10);
    const spoofed = toFile(realJpeg, "wine.png", "image/png");
    const result = await validateAndNormalizeImage(spoofed);
    // The decoded bytes are a real JPEG, so the output must be jpeg —
    // proving File.type was never trusted.
    expect(result.contentType).toBe("image/jpeg");
  });

  it("a text file disguised with an image extension/MIME type is rejected", async () => {
    const text = Buffer.from("this is not an image, just text pretending to be one");
    await expect(validateAndNormalizeImage(toFile(text, "wine.jpg", "image/jpeg"))).rejects.toThrow(
      ImageValidationError,
    );
  });
});

describe("validateAndNormalizeImage — metadata stripping", () => {
  it("strips EXIF metadata from the normalized output", async () => {
    const raw = Buffer.alloc(8 * 8 * 3, 100);
    const withExif = await sharp(raw, { raw: { width: 8, height: 8, channels: 3 } })
      .withMetadata({ exif: { IFD0: { Make: "TestCamera", Software: "GPS-Tracker" } } })
      .jpeg()
      .toBuffer();

    const beforeMeta = await sharp(withExif).metadata();
    expect(beforeMeta.exif).toBeDefined();

    const result = await validateAndNormalizeImage(toFile(withExif, "photo.jpg", "image/jpeg"));
    const afterMeta = await sharp(Buffer.from(result.bytes)).metadata();
    expect(afterMeta.exif).toBeUndefined();
  });
});

describe("validateAndNormalizeImage — animated/multi-page rejection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects an input sharp reports as multi-page (animated WebP/GIF)", async () => {
    // A genuine animated WebP fixture is impractical to hand-construct
    // here; this isolates and exercises the real `pages > 1` branch in
    // `validateAndNormalizeImage` via a controlled sharp mock, with
    // everything else (the module under test) real and unmocked.
    vi.doMock("sharp", () => ({
      default: () => ({
        metadata: async () => ({ format: "webp", width: 10, height: 10, pages: 3 }),
        toFormat: () => ({ toBuffer: async () => Buffer.from([1, 2, 3]) }),
      }),
    }));

    const {
      validateAndNormalizeImage: validateWithMockedSharp,
      ImageValidationError: MockedError,
    } = await import("./validate-image-upload");

    const fakeBytes = Buffer.from([1, 2, 3, 4]);
    await expect(
      validateWithMockedSharp(toFile(fakeBytes, "animated.webp", "image/webp")),
    ).rejects.toThrow(MockedError);

    vi.doUnmock("sharp");
  });
});

describe("validateAndNormalizeImage — invalid dimensions (mocked, not realistically constructible)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects decoded metadata with a zero/missing width or height", async () => {
    vi.doMock("sharp", () => ({
      default: () => ({
        metadata: async () => ({ format: "png", width: 0, height: 10 }),
        toFormat: () => ({ toBuffer: async () => Buffer.from([1, 2, 3]) }),
      }),
    }));

    const {
      validateAndNormalizeImage: validateWithMockedSharp,
      ImageValidationError: MockedError,
    } = await import("./validate-image-upload");

    await expect(
      validateWithMockedSharp(toFile(Buffer.from([1, 2, 3]), "zero.png", "image/png")),
    ).rejects.toThrow(MockedError);

    vi.doUnmock("sharp");
  });
});

describe("validateAndNormalizeImage — oversized re-encoded output", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects when the re-encoded output exceeds the size limit, even though the input was within limits", async () => {
    vi.doMock("sharp", () => ({
      default: () => ({
        metadata: async () => ({ format: "png", width: 10, height: 10 }),
        toFormat: () => ({
          toBuffer: async () => Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0),
        }),
      }),
    }));

    const {
      validateAndNormalizeImage: validateWithMockedSharp,
      ImageValidationError: MockedError,
    } = await import("./validate-image-upload");

    await expect(
      validateWithMockedSharp(toFile(Buffer.from([1, 2, 3]), "small.png", "image/png")),
    ).rejects.toThrow(MockedError);

    vi.doUnmock("sharp");
  });
});
