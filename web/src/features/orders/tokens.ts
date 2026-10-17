import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small signed values kept in httpOnly cookies (HMAC-SHA256 with AUTH_SECRET):
 *
 * - Phone proof: "this browser verified mobile X by OTP at time T". Guest checkout needs one for
 *   the contact mobile before an order can be placed (US-007). Valid for `phoneProofTtlMs`.
 * - Order access: "this browser may open order N until time T", given after placing a guest
 *   order or after tracking one with an OTP (US-008), so a guest can see the order page without
 *   an account. A few recent orders are kept.
 *
 * Pure (secret and clock are passed in), so the rules are unit-tested.
 */

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sameSig(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface PhoneProof {
  phone: string;
  verifiedAt: Date;
}

/** "pp1.<base64url phone>.<verifiedAt ms>.<sig>". */
export function signPhoneProof(secret: string, phone: string, verifiedAt: Date): string {
  const payload = `pp1.${b64(phone)}.${verifiedAt.getTime()}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** The verified mobile, or null when the value is missing, tampered with or older than `ttlMs`. */
export function readPhoneProof(secret: string, value: string | undefined | null, now: Date, ttlMs: number): PhoneProof | null {
  if (!secret || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "pp1") return null;
  const payload = parts.slice(0, 3).join(".");
  if (!sameSig(sign(secret, payload), parts[3])) return null;
  const at = Number(parts[2]);
  if (!Number.isFinite(at) || at > now.getTime() + 60_000 || now.getTime() - at > ttlMs) return null;
  return { phone: unb64(parts[1]), verifiedAt: new Date(at) };
}

/** Most orders one browser keeps access to at once. */
export const MAX_ORDER_GRANTS = 5;

/** One grant per order: "<orderNo>~<expires ms>~<sig>", joined by ",". */
export function addOrderGrant(secret: string, current: string | undefined | null, orderNo: string, now: Date, ttlMs: number): string {
  const kept = parseGrants(secret, current, now).filter((g) => g.orderNo !== orderNo);
  const payload = `${orderNo}~${now.getTime() + ttlMs}`;
  const all = [...kept.map((g) => g.raw), `${payload}~${sign(secret, `og1:${payload}`)}`];
  return all.slice(-MAX_ORDER_GRANTS).join(",");
}

function parseGrants(secret: string, value: string | undefined | null, now: Date) {
  if (!secret || !value) return [];
  return value
    .split(",")
    .map((raw) => {
      const [orderNo, exp, sig] = raw.split("~");
      if (!orderNo || !exp || !sig) return null;
      if (!sameSig(sign(secret, `og1:${orderNo}~${exp}`), sig)) return null;
      if (!(Number(exp) > now.getTime())) return null;
      return { orderNo, raw };
    })
    .filter((g): g is { orderNo: string; raw: string } => g !== null);
}

/** True when the cookie value holds a valid, unexpired grant for this order. */
export function hasOrderGrant(secret: string, value: string | undefined | null, orderNo: string, now: Date): boolean {
  return parseGrants(secret, value, now).some((g) => g.orderNo === orderNo);
}
