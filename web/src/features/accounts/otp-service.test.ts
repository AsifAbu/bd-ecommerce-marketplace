import { describe, expect, it } from "vitest";
import type { OtpProvider } from "@/lib/otp";
import { createOtpService, OTP_RULES, type OtpRecord, type OtpStore } from "./otp-service";

const PHONE = "+8801700000002";

function memoryStore() {
  const rows: (OtpRecord & { ip: string | null })[] = [];
  const store: OtpStore = {
    async create(data) {
      rows.push({ ...data, id: String(rows.length + 1), attempts: 0, consumedAt: null });
    },
    async latest(phone, purpose) {
      return rows.filter((r) => r.phone === phone && r.purpose === purpose).at(-1) ?? null;
    },
    async countSince(by, since) {
      return rows.filter((r) => ("phone" in by ? r.phone === by.phone : r.ip === by.ip) && r.createdAt >= since).length;
    },
    async incrementAttempts(id) {
      const row = rows.find((r) => r.id === id)!;
      return ++row.attempts;
    },
    async consume(id, at) {
      rows.find((r) => r.id === id)!.consumedAt = at;
    },
  };
  return { rows, store };
}

function setup(providerName = "test") {
  let t = new Date("2026-10-16T10:00:00Z");
  const sent: { phone: string; code?: string }[] = [];
  const provider: OtpProvider = {
    name: providerName,
    send: async (phone, code) => void sent.push({ phone, code }),
    verify: async () => false,
  };
  const { rows, store } = memoryStore();
  const otp = createOtpService({ store, provider, secret: "test-secret", now: () => t });
  const advance = (ms: number) => (t = new Date(t.getTime() + ms));
  return { otp, rows, sent, advance };
}

describe("OTP storage", () => {
  it("stores only a hash of the code and sends 123456 in test mode", async () => {
    const { otp, rows, sent } = setup();
    await expect(otp.requestOtp(PHONE, "phone_verify", "1.1.1.1")).resolves.toEqual({ ok: true });
    expect(sent).toEqual([{ phone: PHONE, code: "123456" }]);
    expect(rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].codeHash).not.toContain("123456");
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: true });
  });

  it("uses a random 6-digit code outside test mode", async () => {
    const { otp, sent } = setup("production");
    await otp.requestOtp(PHONE, "phone_verify", null);
    expect(sent[0].code).toMatch(/^\d{6}$/);
    await expect(otp.verifyOtp(PHONE, "phone_verify", sent[0].code!)).resolves.toEqual({ ok: true });
  });

  it("is single use and bound to phone and purpose", async () => {
    const { otp } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    await expect(otp.verifyOtp(PHONE, "password_reset", "123456")).resolves.toMatchObject({ ok: false });
    await expect(otp.verifyOtp("+8801700000009", "phone_verify", "123456")).resolves.toMatchObject({ ok: false });
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: true });
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: false, code: "INVALID" });
  });

  it("rejects when no code was sent", async () => {
    const { otp } = setup();
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: false, code: "INVALID" });
  });
});

describe("OTP expiry", () => {
  it("expires after 5 minutes", async () => {
    const { otp, advance } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    advance(OTP_RULES.ttlMs - 1000);
    advance(1000);
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: false, code: "EXPIRED" });
  });

  it("works just before expiry", async () => {
    const { otp, advance } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    advance(OTP_RULES.ttlMs - 1000);
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: true });
  });
});

describe("OTP attempts", () => {
  it("locks the code after 5 wrong tries, even for the right code", async () => {
    const { otp } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    for (let i = 1; i < OTP_RULES.maxAttempts; i++) {
      await expect(otp.verifyOtp(PHONE, "phone_verify", "000000")).resolves.toEqual({ ok: false, code: "INVALID" });
    }
    await expect(otp.verifyOtp(PHONE, "phone_verify", "000000")).resolves.toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
  });

  it("a new code resets the attempts", async () => {
    const { otp, advance } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    for (let i = 0; i < OTP_RULES.maxAttempts; i++) await otp.verifyOtp(PHONE, "phone_verify", "000000");
    advance(OTP_RULES.resendCooldownMs);
    await otp.requestOtp(PHONE, "phone_verify", null);
    await expect(otp.verifyOtp(PHONE, "phone_verify", "123456")).resolves.toEqual({ ok: true });
  });
});

describe("OTP rate limits", () => {
  it("enforces a resend cooldown", async () => {
    const { otp, advance, sent } = setup();
    await otp.requestOtp(PHONE, "phone_verify", null);
    advance(30_000);
    await expect(otp.requestOtp(PHONE, "phone_verify", null)).resolves.toEqual({ ok: false, code: "COOLDOWN", retryAfterSec: 30 });
    advance(30_000);
    await expect(otp.requestOtp(PHONE, "phone_verify", null)).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(2);
  });

  it("limits sends per mobile number per hour", async () => {
    const { otp, advance } = setup();
    for (let i = 0; i < OTP_RULES.maxPerPhonePerWindow; i++) {
      await expect(otp.requestOtp(PHONE, "phone_verify", `10.0.0.${i}`)).resolves.toEqual({ ok: true });
      advance(OTP_RULES.resendCooldownMs);
    }
    await expect(otp.requestOtp(PHONE, "phone_verify", "10.0.0.99")).resolves.toMatchObject({ ok: false, code: "RATE_LIMITED" });
    advance(OTP_RULES.windowMs);
    await expect(otp.requestOtp(PHONE, "phone_verify", "10.0.0.99")).resolves.toEqual({ ok: true });
  });

  it("limits sends per IP across numbers", async () => {
    const { otp } = setup();
    for (let i = 0; i < OTP_RULES.maxPerIpPerWindow; i++) {
      const phone = `+88017000001${String(i).padStart(2, "0")}`;
      await expect(otp.requestOtp(phone, "phone_verify", "9.9.9.9")).resolves.toEqual({ ok: true });
    }
    await expect(otp.requestOtp("+8801800000000", "phone_verify", "9.9.9.9")).resolves.toMatchObject({ ok: false, code: "RATE_LIMITED" });
    await expect(otp.requestOtp("+8801800000000", "phone_verify", "8.8.8.8")).resolves.toEqual({ ok: true });
  });
});
