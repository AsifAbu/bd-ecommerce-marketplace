import { describe, expect, it } from "vitest";
import { confirmationSms, invoiceEmail, sendOrderConfirmation, type NotifyDeps } from "./notify";
import { summaryStatus, toOrderView, type OrderRowLike } from "./views";

// US-051: one SMS and one email invoice listing every shop order's items, delivery charge and total.

const placedAt = new Date("2026-10-17T06:00:00Z");
const so = (id: string, seq: number, shopName: string, over: Partial<OrderRowLike["shopOrders"][number]> = {}): OrderRowLike["shopOrders"][number] => ({
  id,
  shopId: `shop-${id}`,
  seq,
  status: "placed",
  statusChangedAt: placedAt,
  shopName,
  shopRegistration: null,
  itemsSubtotal: "500.00",
  weightGrams: 500,
  deliveryCharge: "130.00",
  freeDelivery: false,
  total: "630.00",
  vatRate: "0.00",
  vatAmount: "0.00",
  handoverDueAt: new Date(placedAt.getTime() + 48 * 3_600_000),
  cancelReason: null,
  deliveredAt: null,
  items: [{ id: `i-${id}`, productId: "p", title: `${shopName} item`, variantLabel: "Size: M", sku: null, unitPrice: "250.00", quantity: 2, lineTotal: "500.00", warranty: null }],
  ...over,
});

const row: OrderRowLike = {
  id: "o-1",
  orderNo: "BD-261017-ABCDE",
  contactName: "Karim",
  contactPhone: "+8801812345678",
  contactEmail: "karim@ecom.test",
  address: { name: "Karim", phone: "+8801812345678", division: "Chattogram", district: "Chattogram", upazila: "Panchlaish", area: "GEC", line1: "House 1" },
  zone: "outside_dhaka",
  itemsSubtotal: "1000.00",
  deliveryTotal: "130.00",
  grandTotal: "1130.00",
  paymentMethod: "cod",
  placedAt,
  shopOrders: [so("a", 1, "Book Shop"), so("b", 2, "Tech Shop", { deliveryCharge: "0.00", freeDelivery: true, total: "500.00" })],
};

const view = toOrderView(row);

describe("confirmation texts", () => {
  it("the SMS gives the order number, number of shop orders, total and the tracking link", () => {
    expect(confirmationSms(view, "https://x/track?orderNo=BD-261017-ABCDE")).toBe(
      "Order BD-261017-ABCDE placed: 2 shop orders, total Tk 1,130 cash on delivery. Track: https://x/track?orderNo=BD-261017-ABCDE",
    );
  });

  it("the email invoice lists every shop order with its items, delivery charge and total", () => {
    const { subject, text } = invoiceEmail(view, "https://x/track");
    expect(subject).toBe("Your order BD-261017-ABCDE: invoice");
    expect(text).toContain("Shop order BD-261017-ABCDE-1 from Book Shop");
    expect(text).toContain("  2 x Book Shop item (Size: M) @ Tk 250 = Tk 500");
    expect(text).toContain("  Delivery charge: Tk 130");
    expect(text).toContain("Shop order BD-261017-ABCDE-2 from Tech Shop");
    expect(text).toContain("  Delivery charge: Free");
    expect(text).toContain("Total to pay on delivery: Tk 1,130");
    expect(text).toContain("cash on delivery");
  });
});

function deps(over: Partial<NotifyDeps> = {}) {
  const calls = { sms: [] as string[], mail: [] as string[], marked: [] as string[] };
  const state = { smsSentAt: null as Date | null, emailSentAt: null as Date | null };
  const d: NotifyDeps = {
    load: async () => ({ ...view, contactPhoneE164: row.contactPhone, ...state }),
    sendSms: async (phone) => {
      calls.sms.push(phone);
    },
    sendMail: async (m) => {
      calls.mail.push(m.to[0]);
    },
    markSent: async (_id, channel) => {
      calls.marked.push(channel);
      state[channel === "sms" ? "smsSentAt" : "emailSentAt"] = placedAt;
    },
    trackUrl: (no) => `https://x/track?orderNo=${no}`,
    now: () => placedAt,
    log: () => {},
    ...over,
  };
  return { d, calls };
}

describe("sendOrderConfirmation (orders.notify-placed job)", () => {
  it("sends one SMS to the order mobile and one email invoice", async () => {
    const { d, calls } = deps();
    expect(await sendOrderConfirmation("o-1", d)).toEqual({ sms: "sent", email: "sent" });
    expect(calls).toEqual({ sms: ["+8801812345678"], mail: ["karim@ecom.test"], marked: ["sms", "email"] });
  });

  it("fails (so the job retries) when the email fails, and the retry sends only the email", async () => {
    let mailDown = true;
    const { d, calls } = deps({
      sendMail: async () => {
        if (mailDown) throw new Error("SMTP down");
      },
    });
    await expect(sendOrderConfirmation("o-1", d)).rejects.toThrow("email failed");
    expect(calls.marked).toEqual(["sms"]);
    mailDown = false;
    expect(await sendOrderConfirmation("o-1", d)).toEqual({ sms: "already sent", email: "sent" });
    expect(calls.sms).toHaveLength(1);
  });

  it("skips email for an order without one, and a missing order", async () => {
    const { d } = deps({ load: async () => ({ ...view, contactEmail: null, contactPhoneE164: row.contactPhone, smsSentAt: null, emailSentAt: null }) });
    expect(await sendOrderConfirmation("o-1", d)).toEqual({ sms: "sent", email: "no email" });
    expect(await sendOrderConfirmation("o-x", { ...d, load: async () => null })).toEqual({ sms: "no order", email: "no order" });
  });
});

describe("order views", () => {
  it("converts money and phone, and numbers shop orders", () => {
    expect(view.contactPhone).toBe("01812345678");
    expect(view.grandTotal).toBe(1130);
    expect(view.shopOrders.map((s) => [s.shopOrderNo, s.statusLabel])).toEqual([
      ["BD-261017-ABCDE-1", "Placed, waiting for the shop"],
      ["BD-261017-ABCDE-2", "Placed, waiting for the shop"],
    ]);
  });

  it("summarises the order status from its shop orders", () => {
    expect(summaryStatus(["placed", "delivered"])).toBe("Open");
    expect(summaryStatus(["delivered", "delivered"])).toBe("Delivered");
    expect(summaryStatus(["delivered", "cancelled"])).toBe("Completed");
    expect(summaryStatus(["refused"])).toBe("Delivery refused");
  });
});
