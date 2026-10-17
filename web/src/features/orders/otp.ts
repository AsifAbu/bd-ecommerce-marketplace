import { bdMobile, OTP_MESSAGES, type OtpPurpose, type RequestOtpResult, type VerifyOtpResult } from "@/features/accounts";
import { OrderError } from "./errors";
import { parseOrderNo } from "./order-no";
import { addOrderGrant, signPhoneProof } from "./tokens";

/**
 * OTP steps around orders, reusing the accounts OTP service (rate limits, 5 tries, 5-minute
 * codes; test code 123456) with two purposes of their own:
 *
 * - checkout_verify (US-007, US-051): a guest verifies the contact mobile before placing the
 *   order; a logged-in customer with an unverified phone verifies the account phone the same way.
 *   Success returns a signed phone proof (cookie) and whether an account uses this mobile, so the
 *   page can offer "Log in" (only after the mobile is proven, so numbers can't be probed).
 * - order_track (US-008): order number + a code sent to the order's mobile. Success returns a
 *   signed order-access grant (cookie) for that order only. Unknown order numbers get the same
 *   answer as known ones.
 */

export interface OrderOtpDeps {
  otp: {
    requestOtp(phone: string, purpose: OtpPurpose, ip: string | null): Promise<RequestOtpResult>;
    verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<VerifyOtpResult>;
  };
  secret: string;
  now: () => Date;
  orderAccessTtlMs: number;
  /** Any account (verified or not) uses this mobile. */
  accountUsesPhone(phone: string): Promise<boolean>;
  /** The logged-in user's phone, after an OTP proved it: mark it verified. */
  markAccountPhoneVerified(userId: string, phone: string): Promise<void>;
  /** Guest orders of the newly verified phone join the account (US-009). */
  linkGuestOrders(userId: string): Promise<unknown>;
  findOrderPhone(orderNo: string): Promise<{ contactPhone: string } | null>;
}

export const TRACK_SENT_MESSAGE = "If the order number is right, we sent a 6-digit code by SMS to the mobile number used for the order.";

function parsePhone(value: unknown): string {
  const parsed = bdMobile.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) throw new OrderError(422, "VALIDATION", "Check the mobile number", { phone: parsed.error.issues[0].message });
  return parsed.data;
}

function code(value: unknown): string {
  const c = typeof value === "string" ? value.trim() : "";
  if (!/^\d{6}$/.test(c)) throw new OrderError(422, "VALIDATION", "Enter the 6-digit code", { code: "Enter the 6-digit code from the SMS" });
  return c;
}

function sendFailed(res: Extract<RequestOtpResult, { ok: false }>): OrderError {
  return new OrderError(429, res.code, OTP_MESSAGES[res.code], undefined);
}

export function createOrderOtp(deps: OrderOtpDeps) {
  return {
    async sendCheckoutCode(phoneInput: unknown, ip: string | null) {
      const phone = parsePhone(phoneInput);
      const res = await deps.otp.requestOtp(phone, "checkout_verify", ip);
      if (!res.ok) throw sendFailed(res);
      return { sent: true as const, message: "We sent a 6-digit code by SMS. It works for 5 minutes." };
    },

    async verifyCheckoutCode(phoneInput: unknown, codeInput: unknown, user: { id: string; phone: string | null } | null) {
      const phone = parsePhone(phoneInput);
      const res = await deps.otp.verifyOtp(phone, "checkout_verify", code(codeInput));
      if (!res.ok) throw new OrderError(422, res.code, OTP_MESSAGES[res.code], { code: OTP_MESSAGES[res.code] });
      const at = deps.now();
      if (user && user.phone === phone) {
        await deps.markAccountPhoneVerified(user.id, phone);
        await deps.linkGuestOrders(user.id);
      }
      return {
        verified: true as const,
        phone,
        proof: signPhoneProof(deps.secret, phone, at),
        accountExists: user ? false : await deps.accountUsesPhone(phone),
        message: "Mobile number verified.",
      };
    },

    async sendTrackCode(orderNoInput: unknown, ip: string | null) {
      const orderNo = parseOrderNo(orderNoInput);
      if (!orderNo) {
        throw new OrderError(422, "VALIDATION", "Check the order number", { orderNo: "Enter the order number, for example BD-261017-7KQ2M" });
      }
      const order = await deps.findOrderPhone(orderNo);
      if (order) {
        const res = await deps.otp.requestOtp(order.contactPhone, "order_track", ip);
        if (!res.ok) throw sendFailed(res);
      }
      return { sent: true as const, orderNo, message: TRACK_SENT_MESSAGE };
    },

    /** Returns the new grant cookie value (current grants + this order). */
    async verifyTrackCode(orderNoInput: unknown, codeInput: unknown, currentGrants: string | undefined) {
      const orderNo = parseOrderNo(orderNoInput);
      const c = code(codeInput);
      const order = orderNo ? await deps.findOrderPhone(orderNo) : null;
      if (!orderNo || !order) throw new OrderError(422, "INVALID", OTP_MESSAGES.INVALID, { code: OTP_MESSAGES.INVALID });
      const res = await deps.otp.verifyOtp(order.contactPhone, "order_track", c);
      if (!res.ok) throw new OrderError(422, res.code, OTP_MESSAGES[res.code], { code: OTP_MESSAGES[res.code] });
      return { orderNo, grants: addOrderGrant(deps.secret, currentGrants, orderNo, deps.now(), deps.orderAccessTtlMs) };
    },
  };
}

export type OrderOtp = ReturnType<typeof createOrderOtp>;
