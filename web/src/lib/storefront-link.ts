/**
 * Storefront links (US-014). A shop's public storefront lives at `/s/<shop slug>`; the slug is
 * the shop's unique `Shop.slug`, so there is no separate storefront slug. The full link uses the
 * public base URL: APP_URL, else AUTH_URL, else http://localhost:3000.
 */

const DEFAULT_BASE = "http://localhost:3000";

/** Public base URL without a trailing slash. Ignores values that are not http(s) URLs. */
export function appBaseUrl(env: Record<string, string | undefined> = process.env): string {
  for (const raw of [env.APP_URL, env.AUTH_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return value.replace(/\/+$/, "");
    } catch {
      // not a URL: try the next one
    }
  }
  return DEFAULT_BASE;
}

/** "/s/<slug>" */
export function storefrontPath(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`;
}

/** The full link a seller shares, e.g. "https://example.com/s/my-shop". */
export function storefrontUrl(slug: string, base: string = appBaseUrl()): string {
  return `${base.replace(/\/+$/, "")}${storefrontPath(slug)}`;
}

/** Facebook's share dialog for a link. */
export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}
