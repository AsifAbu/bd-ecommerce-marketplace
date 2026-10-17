import { describe, expect, it, vi } from "vitest";
import { safePath } from "@/features/accounts/safe-path";
import { applyWishlistIntent, parseWishlistIntent, productPath, wishlistLoginUrl, withoutIntent } from "./intent";

// US-057: a guest taps the heart, logs in, and the item is saved after login (server side).
describe("guest wishlist intent", () => {
  it("sends the guest to login with a callbackUrl back to the product carrying the intent", () => {
    const url = wishlistLoginUrl("p1", "v-m-black");
    expect(url).toBe(`/login?callbackUrl=${encodeURIComponent("/products/p1?wishlist=add&variant=v-m-black")}`);
    const callback = new URL(url, "http://localhost").searchParams.get("callbackUrl")!;
    // The login action keeps it (same-origin path with its query).
    expect(safePath(callback, "http://localhost:3000")).toBe("/products/p1?wishlist=add&variant=v-m-black");
    expect(wishlistLoginUrl("p1", null)).toBe(`/login?callbackUrl=${encodeURIComponent("/products/p1?wishlist=add")}`);
  });

  it("reads the intent back on the product page", () => {
    expect(parseWishlistIntent({ wishlist: "add", variant: "v-m-black" })).toEqual({ variantId: "v-m-black" });
    expect(parseWishlistIntent({ wishlist: "add" })).toEqual({ variantId: null });
    expect(parseWishlistIntent({ wishlist: ["add", "x"], variant: ["v1", "v2"] })).toEqual({ variantId: "v1" });
    expect(parseWishlistIntent({ variant: "v1" })).toBeNull();
    expect(parseWishlistIntent({ wishlist: "remove" })).toBeNull();
    expect(parseWishlistIntent({ wishlist: "add", variant: "../../etc" })).toEqual({ variantId: null });
  });

  it("saves the item after login, and does nothing for guests or without intent", async () => {
    const addItem = vi.fn(async () => ({}));
    expect(await applyWishlistIntent({ id: "u1" }, "p1", { variantId: "v1" }, addItem)).toBe("saved");
    expect(addItem).toHaveBeenCalledWith("u1", { productId: "p1", variantId: "v1" });
    expect(await applyWishlistIntent(null, "p1", { variantId: "v1" }, addItem)).toBeNull();
    expect(await applyWishlistIntent({ id: "u1" }, "p1", null, addItem)).toBeNull();
    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it("reports a failed save (e.g. the product went offline) without throwing", async () => {
    const addItem = vi.fn(async () => {
      throw new Error("404");
    });
    expect(await applyWishlistIntent({ id: "u1" }, "p1", { variantId: null }, addItem)).toBe("failed");
  });

  it("builds product links and strips the intent but keeps the variant", () => {
    expect(productPath("p1")).toBe("/products/p1");
    expect(productPath("p1", "v1")).toBe("/products/p1?variant=v1");
    expect(withoutIntent("?wishlist=add&variant=v1")).toBe("?variant=v1");
    expect(withoutIntent("?wishlist=add")).toBe("");
  });
});
