import { describe, expect, it } from "vitest";
import { TEST_OTP_CODE } from "@/lib/otp";
import { createOrderOtp, TRACK_SENT_MESSAGE, type OrderOtpDeps } from "./otp";
import { hasOrderGrant, readPhoneProof } from "./tokens";

// US-007 guest mobile verification and US-008 tracking with the order number + an OTP.

const SECRET = "s";
const NOW = new Date("2026-10-17T06:00:00Z");

function setup() {
  const sent: { phone: string; purpose: string }[] = [];
  const marked: string[] = [];
  const linked: string[] = [];
  const deps: OrderOtpDeps = {
    otp: {
      async requestOtp(phone, purpose) {
        sent.push({ phone, purpose });
        return { ok: true };
      },
      async verifyOtp(_phone, _purpose, code) {
        return code === TEST_OTP_CODE ? { ok: true } : { ok: false, code: "INVALID" };
      },
    },
    secret: SECRET,
    now: () => NOW,
    orderAccessTtlMs: 3_600_000,
    accountUsesPhone: async (phone) => phone === "+8801700000002",
    markAccountPhoneVerified: async (userId) => {
      marked.push(userId);
    },
    linkGuestOrders: async (userId) => {
      linked.push(userId);
    },
    findOrderPhone: async (orderNo) => (orderNo === "BD-261016-SEEDC" ? { contactPhone: "+8801700000009" } : null),
  };
  return { otp: createOrderOtp(deps), sent, marked, linked };
}

async function fails(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return err as { status: number; code: string; fields?: Record<string, string> };
  }
  throw new Error("expected an error");
}

describe("checkout mobile OTP", () => {
  it("sends a checkout code to the typed Bangladeshi mobile", async () => {
    const { otp, sent } = setup();
    await otp.sendCheckoutCode("01812-345678", "1.2.3.4");
    expect(sent).toEqual([{ phone: "+8801812345678", purpose: "checkout_verify" }]);
    expect((await fails(otp.sendCheckoutCode("12345", null))).fields).toHaveProperty("phone");
  });

  it("gives a signed proof for that mobile only after the right code (test code 123456)", async () => {
    const { otp } = setup();
    expect((await fails(otp.verifyCheckoutCode("01812345678", "000000", null))).code).toBe("INVALID");
    expect((await fails(otp.verifyCheckoutCode("01812345678", "12", null))).code).toBe("VALIDATION");
    const ok = await otp.verifyCheckoutCode("01812345678", "123456", null);
    expect(readPhoneProof(SECRET, ok.proof, NOW, 60_000)?.phone).toBe("+8801812345678");
    expect(ok.accountExists).toBe(false);
  });

  it("tells a guest the mobile has an account only after the mobile is verified (offer Log in)", async () => {
    const { otp } = setup();
    expect((await otp.verifyCheckoutCode("01700000002", "123456", null)).accountExists).toBe(true);
  });

  it("verifies a logged-in customer's own account phone and links their guest orders", async () => {
    const { otp, marked, linked } = setup();
    await otp.verifyCheckoutCode("01711111111", "123456", { id: "u-1", phone: "+8801711111111" });
    expect(marked).toEqual(["u-1"]);
    expect(linked).toEqual(["u-1"]);
    // Another number than the account's verifies only the checkout, not the account.
    await otp.verifyCheckoutCode("01812345678", "123456", { id: "u-1", phone: "+8801711111111" });
    expect(marked).toEqual(["u-1"]);
  });
});

describe("guest order tracking (US-008)", () => {
  it("sends the code to the ORDER's mobile, and answers the same for an unknown order", async () => {
    const { otp, sent } = setup();
    expect(await otp.sendTrackCode("bd-261016-seedc", null)).toEqual({ sent: true, orderNo: "BD-261016-SEEDC", message: TRACK_SENT_MESSAGE });
    expect(sent).toEqual([{ phone: "+8801700000009", purpose: "order_track" }]);
    expect(await otp.sendTrackCode("BD-261016-ZZZZZ", null)).toEqual({ sent: true, orderNo: "BD-261016-ZZZZZ", message: TRACK_SENT_MESSAGE });
    expect(sent).toHaveLength(1);
    expect((await fails(otp.sendTrackCode("not an order", null))).fields).toHaveProperty("orderNo");
  });

  it("needs the OTP: a wrong code or unknown order gives no access", async () => {
    const { otp } = setup();
    expect((await fails(otp.verifyTrackCode("BD-261016-SEEDC", "000000", undefined))).code).toBe("INVALID");
    expect((await fails(otp.verifyTrackCode("BD-261016-ZZZZZ", "123456", undefined))).code).toBe("INVALID");
  });

  it("grants access to that order only after the right code", async () => {
    const { otp } = setup();
    const { orderNo, grants } = await otp.verifyTrackCode("BD-261016-SEEDC", "123456", undefined);
    expect(orderNo).toBe("BD-261016-SEEDC");
    expect(hasOrderGrant(SECRET, grants, "BD-261016-SEEDC", NOW)).toBe(true);
    expect(hasOrderGrant(SECRET, grants, "BD-261005-SEEDA", NOW)).toBe(false);
  });
});
