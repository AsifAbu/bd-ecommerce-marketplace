/** Product images (US-032): JPEG, PNG or WebP, at most 5 MB each and 8 per product. */

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** The image type from the file's first bytes (the declared type and name are not trusted). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
