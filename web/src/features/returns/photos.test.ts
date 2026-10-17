import { describe, expect, it } from "vitest";
import { ReturnError } from "./errors";
import { storeReturnPhotos, type PhotoDeps } from "./photos";

// Return photos: validated always; optional in test mode (a storage failure saves the request
// without them); required for damaged/wrong/not-as-described in production, where a storage
// failure refuses the request with a clear 503.

const file = (type = "image/png", size = 1000) => ({ name: "a.png", type, size, bytes: async () => new Uint8Array(size) });
const deps = (testMode: boolean, fail = false): PhotoDeps & { keys: string[] } => {
  const keys: string[] = [];
  return {
    keys,
    testMode,
    newKey: (ext) => `returns/${keys.length}${ext}`,
    putObject: async (key) => {
      if (fail) throw new Error("Storage not configured");
      keys.push(key);
    },
  };
};

async function rejects(p: Promise<unknown>): Promise<ReturnError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ReturnError) return e;
    throw e;
  }
  throw new Error("expected a ReturnError");
}

describe("storeReturnPhotos", () => {
  it("stores up to 4 images and ignores empty file inputs", async () => {
    const d = deps(false);
    expect(await storeReturnPhotos([file(), file("image/jpeg"), file("image/png", 0)], "damaged", d)).toEqual({ keys: ["returns/0.png", "returns/1.jpg"], warning: null });
  });

  it("rejects other types, too many and too large", async () => {
    expect((await rejects(storeReturnPhotos([file("application/pdf")], "damaged", deps(true)))).fields?.photos).toMatch(/JPEG/);
    expect((await rejects(storeReturnPhotos([file(), file(), file(), file(), file()], "damaged", deps(true)))).fields?.photos).toMatch(/up to 4/);
    expect((await rejects(storeReturnPhotos([file("image/png", 6 * 1024 * 1024)], "damaged", deps(true)))).fields?.photos).toMatch(/5 MB/);
  });

  it("production: requires a photo for damaged, wrong and not-as-described; not for change of mind", async () => {
    for (const reason of ["damaged", "wrong_item", "not_as_described"] as const) {
      expect((await rejects(storeReturnPhotos([], reason, deps(false)))).code).toBe("VALIDATION");
    }
    expect(await storeReturnPhotos([], "change_of_mind", deps(false))).toEqual({ keys: [], warning: null });
  });

  it("production: storage down -> 503 PHOTO_UPLOAD_UNAVAILABLE", async () => {
    const e = await rejects(storeReturnPhotos([file()], "damaged", deps(false, true)));
    expect([e.status, e.code]).toEqual([503, "PHOTO_UPLOAD_UNAVAILABLE"]);
  });

  it("test mode: optional, and storage down saves nothing but returns a warning", async () => {
    expect(await storeReturnPhotos([], "damaged", deps(true))).toEqual({ keys: [], warning: null });
    const r = await storeReturnPhotos([file()], "damaged", deps(true, true));
    expect(r.keys).toEqual([]);
    expect(r.warning).toMatch(/could not be saved/);
  });
});
