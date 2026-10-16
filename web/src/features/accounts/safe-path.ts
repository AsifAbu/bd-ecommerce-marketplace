/**
 * Where to send the user after login. Accepts a relative path or an absolute URL on our own
 * origin (Auth.js passes absolute callback URLs); anything else falls back to /account,
 * so the login form can't be used as an open redirect.
 */
export function safePath(target: string, appOrigin = process.env.AUTH_URL ?? "http://localhost:3000"): string {
  try {
    const base = new URL(appOrigin);
    const url = new URL(target, base);
    if (url.origin === base.origin) return url.pathname + url.search + url.hash;
  } catch {
    // invalid URL: fall through
  }
  return "/account";
}
