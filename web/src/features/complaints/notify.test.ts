import { describe, expect, it, vi } from "vitest";
import { complaintMessages, sendComplaintNotification, type ComplaintNotifyFacts } from "./notify";

// US-072: the customer is informed when the ticket is received, answered and resolved; the shop
// and admins learn about new tickets and customer replies; the admin is alerted when overdue.

const f: ComplaintNotifyFacts = {
  ticketNo: "CP-261015-ABCDE",
  subject: "Parcel not delivered",
  statusLabel: "Resolved",
  dueAtText: "18 Oct 2026, 12:00 pm",
  resolution: "Courier redelivered on 16 Oct.",
  orderNo: "BD-261015-AAAAA",
  customer: { name: "Karim", phone: "+8801711111111", email: "karim@ecom.test" },
  shopEmails: ["owner@shop.test"],
  adminEmails: ["admin@ecom.test"],
  message: null,
  customerUrl: "http://x/complaints/t1",
  sellerUrl: "http://x/seller/s1/complaints/t1",
  adminUrl: "http://x/admin/complaints/t1",
};

const to = (msgs: ReturnType<typeof complaintMessages>) => msgs.map((m) => (m.channel === "sms" ? `sms:${m.to}` : `email:${m.to.join(",")}`));

describe("complaint messages", () => {
  it("opened: acknowledgement with the 72 h due time to the customer; shop and admin told", () => {
    const msgs = complaintMessages("opened", f);
    expect(to(msgs)).toEqual(["sms:+8801711111111", "email:karim@ecom.test", "email:owner@shop.test", "email:admin@ecom.test"]);
    expect(msgs[0].text).toContain("resolve it by 18 Oct 2026, 12:00 pm (within 72 hours)");
  });

  it("every status change reaches the customer", () => {
    for (const event of ["in_progress", "resolved", "closed"] as const) {
      expect(to(complaintMessages(event, f)).slice(0, 2)).toEqual(["sms:+8801711111111", "email:karim@ecom.test"]);
    }
    expect(complaintMessages("resolved", f)[0].text).toContain("Courier redelivered on 16 Oct.");
  });

  it("a shop or admin reply goes to the customer; a customer reply to the shop and admins", () => {
    expect(to(complaintMessages("reply", { ...f, message: { authorRole: "shop", text: "We are checking." } }))).toEqual(["sms:+8801711111111", "email:karim@ecom.test"]);
    expect(to(complaintMessages("reply", { ...f, message: { authorRole: "customer", text: "Any news?" } }))).toEqual(["email:owner@shop.test", "email:admin@ecom.test"]);
  });

  it("overdue alerts the admins only", () => {
    const msgs = complaintMessages("overdue", f);
    expect(to(msgs)).toEqual(["email:admin@ecom.test"]);
    expect(msgs[0].channel === "email" && msgs[0].subject).toBe("OVERDUE complaint CP-261015-ABCDE");
  });

  it("a ticket without a shop skips the shop email", () => {
    expect(to(complaintMessages("opened", { ...f, shopEmails: [], sellerUrl: null }))).not.toContain("email:owner@shop.test");
  });
});

describe("sendComplaintNotification", () => {
  it("throws after a failed message so the job retries", async () => {
    const sendSms = vi.fn(async () => {
      throw new Error("gateway");
    });
    await expect(sendComplaintNotification("t1", "resolved", undefined, { load: async () => f, sendSms, sendMail: vi.fn(async () => {}) })).rejects.toThrow("sms failed");
  });
});
