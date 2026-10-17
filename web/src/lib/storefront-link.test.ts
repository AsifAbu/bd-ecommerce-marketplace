import { describe, expect, it } from "vitest";
import { appBaseUrl, facebookShareUrl, storefrontPath, storefrontUrl } from "./storefront-link";

describe("appBaseUrl", () => {
  it("prefers APP_URL, then AUTH_URL, then localhost", () => {
    expect(appBaseUrl({ APP_URL: "https://shop.example.com", AUTH_URL: "https://auth.example.com" })).toBe("https://shop.example.com");
    expect(appBaseUrl({ AUTH_URL: "https://auth.example.com/" })).toBe("https://auth.example.com");
    expect(appBaseUrl({})).toBe("http://localhost:3000");
  });

  it("skips empty or invalid values", () => {
    expect(appBaseUrl({ APP_URL: " ", AUTH_URL: "http://localhost:3106" })).toBe("http://localhost:3106");
    expect(appBaseUrl({ APP_URL: "not a url", AUTH_URL: "ftp://x" })).toBe("http://localhost:3000");
  });
});

describe("storefront links", () => {
  it("builds the path and full link from the shop slug", () => {
    expect(storefrontPath("test-tech-shop")).toBe("/s/test-tech-shop");
    expect(storefrontUrl("test-tech-shop", "https://example.com/")).toBe("https://example.com/s/test-tech-shop");
    expect(storefrontUrl("test-tech-shop", "https://example.com/app")).toBe("https://example.com/app/s/test-tech-shop");
  });

  it("encodes unexpected characters", () => {
    expect(storefrontPath("a b/c")).toBe("/s/a%20b%2Fc");
  });

  it("builds a Facebook share link with the URL encoded", () => {
    expect(facebookShareUrl("https://example.com/s/my-shop?x=1&y=2")).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fs%2Fmy-shop%3Fx%3D1%26y%3D2",
    );
  });
});
