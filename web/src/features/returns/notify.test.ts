import { describe, expect, it, vi } from "vitest";
import { returnMessages, sendReturnNotification, type ReturnNotifyFacts } from "./notify";

// US-071: "when the refund is paid manually, the shop records the method and reference, and I am
// notified"; escalations reach the admin; new requests reach the shop.

const facts: ReturnNotifyFacts = {
  orderNo: "BD-261010-AAAAA",
  shopOrderNo: "BD-261010-AAAAA-1",
  itemTitle: "Oxford shirt",
  quantity: 1,
  reasonLabel: "Damaged, defective, incomplete or expired",
  shopName: "Fashion Shop",
  shopNote: null,
  adminNote: null,
  escalationReason: "no_response",
  refund: { amount: "1920.00", methodLabel: "bKash", reference: "8N7A6B5C" },
  customer: { name: "Karim", phone: "+8801711111111", email: "karim@ecom.test" },
  shopEmails: ["owner@shop.test", "staff@shop.test"],
  adminEmails: ["admin@ecom.test"],
  orderUrl: "http://x/orders/BD-261010-AAAAA",
  sellerUrl: "http://x/seller/s1/returns",
  adminUrl: "http://x/admin/returns",
};

describe("return messages", () => {
  it("refunded: the customer gets an SMS and an email with amount, method and reference", () => {
    const msgs = returnMessages("refunded", facts);
    expect(msgs.map((m) => m.channel)).toEqual(["sms", "email"]);
    expect(msgs[0]).toMatchObject({ to: "+8801711111111" });
    for (const m of msgs) expect(m.text).toContain("Tk 1920.00 for 1 x Oxford shirt (order BD-261010-AAAAA-1) paid by bKash, reference 8N7A6B5C");
  });

  it("escalated: the customer is told and every admin gets an email", () => {
    const msgs = returnMessages("escalated", facts);
    expect(msgs.find((m) => m.channel === "email" && m.to.includes("admin@ecom.test"))?.text).toContain("did not answer within 48 hours");
    expect(msgs.some((m) => m.channel === "sms")).toBe(true);
  });

  it("requested: SMS to the customer, email to the shop's owner and staff", () => {
    const msgs = returnMessages("requested", facts);
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ channel: "email", to: ["owner@shop.test", "staff@shop.test"] });
    expect(msgs[1].channel === "email" && msgs[1].subject).toBe("Return request for BD-261010-AAAAA-1: answer within 48 h");
  });

  it("a guest without email gets the SMS only", () => {
    expect(returnMessages("accepted", { ...facts, customer: { ...facts.customer, email: null } }).map((m) => m.channel)).toEqual(["sms"]);
  });
});

describe("sendReturnNotification", () => {
  it("sends every message, and throws after a failure so the job retries", async () => {
    const sendSms = vi.fn(async () => {});
    const sendMail = vi.fn(async () => {
      throw new Error("SMTP down");
    });
    await expect(sendReturnNotification("r1", "refunded", { load: async () => facts, sendSms, sendMail })).rejects.toThrow("email failed");
    expect(sendSms).toHaveBeenCalledOnce();
  });

  it("does nothing for a missing request", async () => {
    expect(await sendReturnNotification("gone", "refunded", { load: async () => null, sendSms: vi.fn(), sendMail: vi.fn() })).toEqual({ sent: 0 });
  });
});
