import { describe, expect, it } from "vitest";
import { shortDescription, storefrontMetadata } from "./metadata";

const shop = { name: "Test Tech Shop", description: "Processors and RAM.", bannerUrl: null, logoUrl: null };
const url = "https://example.com/s/test-tech-shop";

describe("storefrontMetadata", () => {
  it("uses the banner for a large Facebook/Twitter preview", () => {
    const m = storefrontMetadata({ ...shop, bannerUrl: "https://cdn.example.com/banner.jpg", logoUrl: "https://cdn.example.com/logo.png" }, url);
    expect(m.openGraph).toMatchObject({
      url,
      title: "Test Tech Shop",
      description: "Processors and RAM.",
      images: [{ url: "https://cdn.example.com/banner.jpg", alt: "Test Tech Shop" }],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: ["https://cdn.example.com/banner.jpg"] });
    expect(m.alternates?.canonical).toBe(url);
  });

  it("falls back to the logo, then to no image; ignores non-web URLs", () => {
    const logo = storefrontMetadata({ ...shop, bannerUrl: "javascript:alert(1)", logoUrl: "https://cdn.example.com/logo.png" }, url);
    expect(logo.openGraph).toMatchObject({ images: [{ url: "https://cdn.example.com/logo.png" }] });
    expect(logo.twitter).toMatchObject({ card: "summary" });
    expect(storefrontMetadata(shop, url).openGraph?.images).toBeUndefined();
  });

  it("writes a default description when the shop has none", () => {
    expect(storefrontMetadata({ ...shop, description: "  " }, url).description).toMatch(/^Shop Test Tech Shop on /);
  });
});

describe("shortDescription", () => {
  it("flattens and cuts long text at a word", () => {
    expect(shortDescription("a\n\nb   c")).toBe("a b c");
    const long = "word ".repeat(100);
    const cut = shortDescription(long, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("word…")).toBe(true);
  });
});
