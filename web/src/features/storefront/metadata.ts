import type { Metadata } from "next";

/**
 * Open Graph / Twitter tags for a storefront (US-014), so a link shared on Facebook shows the
 * shop's name, description and banner (or logo). Pure: the caller passes the full page URL.
 */

export const SITE_NAME = "Marketplace";
const DESCRIPTION_MAX = 200;

interface MetadataShop {
  name: string;
  description: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
}

export const isWebUrl =(value: string | null): value is string => {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** One line, cut at a word boundary with an ellipsis. */
export function shortDescription(text: string, max = DESCRIPTION_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

export function storefrontMetadata(shop: MetadataShop, url: string): Metadata {
  const title = `${shop.name} | ${SITE_NAME}`;
  const description = shop.description?.trim()
    ? shortDescription(shop.description)
    : `Shop ${shop.name} on ${SITE_NAME}. Cash on delivery across Bangladesh.`;
  const banner = isWebUrl(shop.bannerUrl) ? shop.bannerUrl : null;
  const image = banner ?? (isWebUrl(shop.logoUrl) ? shop.logoUrl : null);
  const images = image ? [{ url: image, alt: shop.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: SITE_NAME, title: shop.name, description, images },
    twitter: { card: banner ? "summary_large_image" : "summary", title: shop.name, description, images: image ? [image] : undefined },
  };
}
