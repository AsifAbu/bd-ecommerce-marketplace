import { ReturnError } from "./errors";
import type { ReturnReason } from "./rules";

/**
 * Return photos (US-070: "a reason and photos"). Decision while MinIO may be missing:
 *
 * - Production: at least one photo is required for damaged, wrong-item and not-as-described
 *   returns (the shop and admin judge them). When the store is unreachable the request is refused
 *   with 503 PHOTO_UPLOAD_UNAVAILABLE and nothing is saved, so no request lacks its evidence.
 * - Test mode: photos are optional. When the store is unreachable the request is still saved,
 *   without photos, and the customer is told (pre-release checklist item).
 *
 * Photos go to the private bucket under returns/<uuid>.<ext>; staff open them via signed URLs.
 */

export const MAX_RETURN_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
export const PHOTO_REQUIRED_REASONS: readonly ReturnReason[] = ["damaged", "wrong_item", "not_as_described"];

export interface PhotoFile {
  name: string;
  type: string;
  size: number;
  bytes(): Promise<Uint8Array>;
}

export interface PhotoDeps {
  testMode: boolean;
  newKey(ext: string): string;
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

export interface StoredPhotos {
  keys: string[];
  /** Set when photos were given but could not be stored (test mode only). */
  warning: string | null;
}

/** Validates the files (type, size, count), then stores them. Empty file inputs are ignored. */
export async function storeReturnPhotos(files: readonly PhotoFile[], reason: ReturnReason, deps: PhotoDeps): Promise<StoredPhotos> {
  const given = files.filter((f) => f.size > 0);
  if (given.length > MAX_RETURN_PHOTOS) {
    throw new ReturnError(422, "VALIDATION", "Too many photos", { photos: `Add up to ${MAX_RETURN_PHOTOS} photos` });
  }
  for (const f of given) {
    if (!PHOTO_TYPES[f.type]) throw new ReturnError(422, "VALIDATION", "Photos must be JPEG, PNG or WebP", { photos: "Use JPEG, PNG or WebP photos" });
    if (f.size > MAX_PHOTO_BYTES) throw new ReturnError(422, "VALIDATION", "A photo is too large", { photos: "Each photo must be 5 MB or smaller" });
  }
  if (given.length === 0) {
    if (!deps.testMode && PHOTO_REQUIRED_REASONS.includes(reason)) {
      throw new ReturnError(422, "VALIDATION", "Add a photo of the problem", { photos: "Add at least one photo showing the problem" });
    }
    return { keys: [], warning: null };
  }
  const keys: string[] = [];
  try {
    for (const f of given) {
      const key = deps.newKey(PHOTO_TYPES[f.type]);
      await deps.putObject(key, await f.bytes(), f.type);
      keys.push(key);
    }
  } catch (err) {
    console.error("[returns] photo upload failed", err);
    if (!deps.testMode) {
      throw new ReturnError(503, "PHOTO_UPLOAD_UNAVAILABLE", "Photo upload is not available right now. Please try again in a few minutes.");
    }
    return { keys: [], warning: "Your photos could not be saved (photo storage is not available in this test setup). The request was sent without them." };
  }
  return { keys, warning: null };
}
