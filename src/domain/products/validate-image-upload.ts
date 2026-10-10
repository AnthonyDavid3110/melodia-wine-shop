import sharp from "sharp";

/**
 * Server-side product-image validation/normalization (Phase 15,
 * TBD-ARCH-006, Gate ARCH-006-D). Pure domain logic — no Next.js, no
 * database, no storage provider — directly unit-testable with synthetic
 * in-memory fixtures, same convention as every other `src/domain/`
 * module. Framework-agnostic deliberately: unlike the infrastructure
 * provider adapters, this needs no `server-only` guard — `sharp` is a
 * native Node addon, not a secret, and runs fine under plain Node
 * (verified directly against the installed package during this gate's
 * preflight, not assumed).
 *
 * Every numeric/behavioral claim below (accepted `metadata().format`
 * strings, EXIF-stripping-by-default on a plain re-encode, `pages`
 * reporting on a static image, `metadata()` rejecting a corrupt-header
 * input) was verified empirically against the installed `sharp@0.35.5`
 * during the Gate ARCH-006-D preflight/implementation, never assumed
 * from memory (CLAUDE.md §39).
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;

export type AcceptedImageContentType = "image/jpeg" | "image/png" | "image/webp";

const CONTENT_TYPE_BY_FORMAT: Record<"jpeg" | "png" | "webp", AcceptedImageContentType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface NormalizedImage {
  /** Fully re-encoded output — never the original untrusted bytes. Metadata (EXIF, ICC, etc.) stripped by construction: a plain `sharp().toFormat().toBuffer()` call never preserves it unless `.withMetadata()` is explicitly called, which this never does. */
  bytes: Uint8Array;
  contentType: AcceptedImageContentType;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Validates and re-encodes an admin-supplied product image. Never
 * trusts `file.type` or `file.name` — the decoded format from `sharp`
 * is the only thing that determines the output content type. Rejects
 * before any expensive work wherever possible: the cheap `file.size`
 * check happens before any byte is read, and the format/dimension
 * checks happen before the full re-encode.
 *
 * Deliberately does NOT rely on `metadata()` alone as proof the image
 * fully decodes — `toFormat().toBuffer()` below forces a complete
 * decode/re-encode pass, so a file with a superficially valid header
 * but corrupted pixel data still gets caught (verified directly against
 * a deliberately corrupted-body JPEG during this gate's preflight).
 */
export async function validateAndNormalizeImage(file: File): Promise<NormalizedImage> {
  if (file.size === 0) {
    throw new ImageValidationError("Le fichier est vide.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("L'image dépasse la taille maximale de 5 Mo.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let metadata;
  try {
    // sharp's own `failOn` option defaults to `'warning'` — the
    // strictest practical level, and the one sharp's own documentation
    // recommends for untrusted input. Never loosened here.
    metadata = await sharp(bytes).metadata();
  } catch {
    throw new ImageValidationError("Le fichier n'est pas une image valide.");
  }

  const format = metadata.format;
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    throw new ImageValidationError(
      "Formats d'image acceptés : JPEG, PNG ou WebP (SVG, GIF et autres formats non pris en charge).",
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError("Le fichier n'est pas une image valide.");
  }

  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    throw new ImageValidationError(
      `L'image dépasse les dimensions maximales de ${MAX_IMAGE_DIMENSION} × ${MAX_IMAGE_DIMENSION} pixels.`,
    );
  }

  // `pages` is only present/>1 for multi-frame input (animated
  // GIF/WebP, multi-page TIFF/PDF) — absent (undefined) for an
  // ordinary static image, verified directly during this gate's
  // preflight. GIF is already excluded by the format allowlist above;
  // this specifically catches an animated WebP, which otherwise would
  // pass that allowlist.
  if (metadata.pages && metadata.pages > 1) {
    throw new ImageValidationError("Les images animées ne sont pas prises en charge.");
  }

  const contentType = CONTENT_TYPE_BY_FORMAT[format];

  let normalizedBytes: Buffer;
  try {
    // Deliberately no `.resize()` (never upscale/downscale — the
    // dimension cap above only rejects, it never transforms) and no
    // `.withMetadata()` (so EXIF/ICC/other metadata is dropped by
    // default, verified empirically during this gate's preflight).
    normalizedBytes = await sharp(bytes).toFormat(format).toBuffer();
  } catch {
    throw new ImageValidationError("Le fichier n'a pas pu être traité.");
  }

  if (normalizedBytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("L'image générée dépasse la taille maximale de 5 Mo.");
  }

  return { bytes: normalizedBytes, contentType };
}
