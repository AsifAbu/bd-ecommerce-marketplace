/**
 * Client IP for rate limits: the first X-Forwarded-For hop (set by the host's proxy), else X-Real-IP.
 * Only trustworthy behind a proxy that overwrites these headers; treat it as a best-effort key.
 */
export function ipFromHeaders(headers: Pick<Headers, "get">): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null;
}
