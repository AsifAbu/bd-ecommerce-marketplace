import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { OtpProvider } from "@/lib/otp";
import { TEST_OTP_CODE } from "@/lib/otp";

/** checkout_verify and order_track are used by the orders feature (guest checkout and tracking). */
export type OtpPurpose = "phone_verify" | "password_reset" | "checkout_verify" | "order_track";

/** Testing values; final values are decided before release. */
export const OTP_RULES = {
  ttlMs: 5 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
  windowMs: 60 * 60_000,
  maxPerPhonePerWindow: 5,
  maxPerIpPerWindow: 20,
} as const;

export interface OtpRecord {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface OtpStore {
  create(data: { phone: string; purpose: OtpPurpose; codeHash: string; ip: string | null; expiresAt: Date; createdAt: Date }): Promise<void>;
  /** Most recent code for this phone and purpose. */
  latest(phone: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  countSince(by: { phone: string } | { ip: string }, since: Date): Promise<number>;
  /** Atomically adds one attempt and returns the new count. */
  incrementAttempts(id: string): Promise<number>;
  consume(id: string, at: Date): Promise<void>;
}

export type RequestOtpResult = { ok: true } | { ok: false; code: "COOLDOWN" | "RATE_LIMITED"; retryAfterSec: number };
export type VerifyOtpResult = { ok: true } | { ok: false; code: "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS" };

export interface OtpServiceDeps {
  store: OtpStore;
  provider: OtpProvider;
  secret: string;
  now?: () => Date;
}

/**
 * Phone OTP: stores an HMAC of the code, expires it after 5 minutes, allows 5
 * attempts, a 60 s resend cooldown and per-number / per-IP send limits.
 * The test provider uses the fixed code 123456; otherwise a random 6-digit code.
 */
export function createOtpService({ store, provider, secret, now = () => new Date() }: OtpServiceDeps) {
  const hash = (phone: string, purpose: OtpPurpose, code: string) =>
    createHmac("sha256", secret).update(`${purpose}:${phone}:${code}`).digest("hex");

  async function requestOtp(phone: string, purpose: OtpPurpose, ip: string | null): Promise<RequestOtpResult> {
    const t = now();
    const last = await store.latest(phone, purpose);
    if (last) {
      const wait = last.createdAt.getTime() + OTP_RULES.resendCooldownMs - t.getTime();
      if (wait > 0) return { ok: false, code: "COOLDOWN", retryAfterSec: Math.ceil(wait / 1000) };
    }
    const since = new Date(t.getTime() - OTP_RULES.windowMs);
    const limited =
      (await store.countSince({ phone }, since)) >= OTP_RULES.maxPerPhonePerWindow ||
      (ip !== null && (await store.countSince({ ip }, since)) >= OTP_RULES.maxPerIpPerWindow);
    if (limited) return { ok: false, code: "RATE_LIMITED", retryAfterSec: OTP_RULES.windowMs / 1000 };

    const code = provider.name === "test" ? TEST_OTP_CODE : String(randomInt(0, 1_000_000)).padStart(6, "0");
    await store.create({
      phone,
      purpose,
      codeHash: hash(phone, purpose, code),
      ip,
      expiresAt: new Date(t.getTime() + OTP_RULES.ttlMs),
      createdAt: t,
    });
    await provider.send(phone, code);
    return { ok: true };
  }

  async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<VerifyOtpResult> {
    const record = await store.latest(phone, purpose);
    if (!record || record.consumedAt) return { ok: false, code: "INVALID" };
    if (record.expiresAt.getTime() <= now().getTime()) return { ok: false, code: "EXPIRED" };
    if (record.attempts >= OTP_RULES.maxAttempts) return { ok: false, code: "TOO_MANY_ATTEMPTS" };

    const attempts = await store.incrementAttempts(record.id);
    if (attempts > OTP_RULES.maxAttempts) return { ok: false, code: "TOO_MANY_ATTEMPTS" };
    const given = Buffer.from(hash(phone, purpose, code.trim()), "hex");
    if (!timingSafeEqual(given, Buffer.from(record.codeHash, "hex"))) {
      return attempts >= OTP_RULES.maxAttempts
        ? { ok: false, code: "TOO_MANY_ATTEMPTS" }
        : { ok: false, code: "INVALID" };
    }
    await store.consume(record.id, now());
    return { ok: true };
  }

  return { requestOtp, verifyOtp };
}

export const OTP_MESSAGES: Record<string, string> = {
  COOLDOWN: "Please wait before asking for a new code.",
  RATE_LIMITED: "Too many codes requested. Try again later.",
  INVALID: "That code is not right. Check it and try again.",
  EXPIRED: "That code has expired. Ask for a new one.",
  TOO_MANY_ATTEMPTS: "Too many wrong tries. Ask for a new code.",
};
