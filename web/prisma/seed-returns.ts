/**
 * Seed for returns and complaints (US-070 to US-072). Test data only; idempotent: fixed order
 * numbers and ids, and every run moves the dates relative to "now" so the 7-day window, the 48 h
 * shop answer and the 72 h complaint timer always show the intended state:
 *
 *   BD-261001-RTNA2  shirt x2, delivered 2 days ago   return REQUESTED 2 h ago (shop has 46 h)
 *   BD-261001-RTNB3  RAM, delivered 4 days ago        return REQUESTED 50 h ago: OVERDUE, the job escalates it
 *   BD-261001-RTNC4  Himu x2, delivered 5 days ago    return ACCEPTED (1 unit); complaint IN PROGRESS
 *   BD-261001-RTND5  denim, delivered 6 days ago      return REJECTED, then ESCALATED by the customer's dispute
 *   BD-261001-RTNE6  guest 01700000009, RAM           return APPROVED by the admin after no shop answer
 *   BD-261001-RTNF7  maths book, delivered 10 days    return DENIED
 *   BD-261001-RTNG8  shirt, delivered 3 days ago      return RECEIVED (restocked)
 *   BD-261001-RTNH9  RAM, delivered 9 days ago        return REFUNDED by bKash; shop order RETURNED; complaint RESOLVED
 *   BD-261001-RTNJ2  paracetamol x2, delivered 1 day  no return: medicine is excluded unless damaged or wrong
 *   BD-261001-RTNK3  Himu, delivered 8 days ago       no return: the 7-day window is closed; complaint OVERDUE (80 h)
 *
 * All belong to customer.verified@ecom.test except RTNE6 (guest, track with 01700000009).
 */
import { prisma } from "../src/lib/db";
import { deliveryCharge } from "../src/lib/delivery";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Line = { shop: string; title: string; optionKey?: string; quantity: number };
type SeedOrder = { orderNo: string; guest?: boolean; deliveredDaysAgo: number; line: Line; status?: "delivered" | "returned" };

const SHIRT = { shop: "test-fashion-shop", title: "[TEST] Oxford cotton shirt", optionKey: "colour=black;size=m" };
const DENIM = { shop: "test-fashion-shop", title: "[TEST] Slim denim pants", optionKey: "colour=blue;size=32" };
const RAM = { shop: "test-tech-shop", title: "[TEST] Corsair Vengeance 16GB DDR5 RAM" };
const HIMU = { shop: "test-book-shop", title: "[TEST] Himu (paperback)" };
const MATHS = { shop: "test-book-shop", title: "[TEST] Engineering Mathematics" };
const PARA = { shop: "test-pharmacy", title: "[TEST] Paracetamol 500 mg tablets" };

const ORDERS: SeedOrder[] = [
  { orderNo: "BD-261001-RTNA2", deliveredDaysAgo: 2, line: { ...SHIRT, quantity: 2 } },
  { orderNo: "BD-261001-RTNB3", deliveredDaysAgo: 4, line: { ...RAM, quantity: 1 } },
  { orderNo: "BD-261001-RTNC4", deliveredDaysAgo: 5, line: { ...HIMU, quantity: 2 } },
  { orderNo: "BD-261001-RTND5", deliveredDaysAgo: 6, line: { ...DENIM, quantity: 1 } },
  { orderNo: "BD-261001-RTNE6", guest: true, deliveredDaysAgo: 6, line: { ...RAM, quantity: 1 } },
  { orderNo: "BD-261001-RTNF7", deliveredDaysAgo: 10, line: { ...MATHS, quantity: 1 } },
  { orderNo: "BD-261001-RTNG8", deliveredDaysAgo: 3, line: { ...SHIRT, quantity: 1 } },
  { orderNo: "BD-261001-RTNH9", deliveredDaysAgo: 9, line: { ...RAM, quantity: 1 }, status: "returned" },
  { orderNo: "BD-261001-RTNJ2", deliveredDaysAgo: 1, line: { ...PARA, quantity: 2 } },
  { orderNo: "BD-261001-RTNK3", deliveredDaysAgo: 8, line: { ...HIMU, quantity: 1 } },
];

const money = (paisa: number) => (paisa / 100).toFixed(2);

interface Placed {
  orderId: string;
  shopOrderId: string;
  shopId: string;
  itemId: string;
  userId: string | null;
  contactPhone: string;
  unitPrice: string;
  deliveryCharge: string;
  deliveredAt: Date;
}

async function ensureOrder(o: SeedOrder, now: Date): Promise<Placed> {
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "customer.verified@ecom.test" }, select: { id: true } });
  const contact = o.guest
    ? { name: "[TEST] Guest shopper", phone: "+8801700000009", email: "guest.shopper@ecom.test" }
    : { name: "[TEST] Customer, verified phone and email", phone: "+8801700000002", email: "customer.verified@ecom.test" };
  const address = o.guest
    ? { name: contact.name, phone: contact.phone, division: "Sylhet", district: "Sylhet", upazila: "Sylhet Sadar", area: "Zindabazar", line1: "House 3, Lane 2" }
    : { name: contact.name, phone: contact.phone, division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", area: "Dhanmondi 27", line1: "House 10, Road 27" };
  const deliveredAt = new Date(now.getTime() - o.deliveredDaysAgo * DAY);
  const placedAt = new Date(deliveredAt.getTime() - 3 * DAY);

  const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: o.line.shop } });
  const product = await prisma.product.findFirstOrThrow({ where: { shopId: shop.id, title: o.line.title, deletedAt: null }, include: { category: { select: { commissionRate: true } } } });
  const variant = await prisma.productVariant.findUniqueOrThrow({ where: { productId_optionKey: { productId: product.id, optionKey: o.line.optionKey ?? "" } } });
  const attrs = product.attributes as Record<string, unknown>;
  const unit = Math.round(Number(variant.price) * 100);
  const weight = (typeof attrs.weight_g === "number" ? attrs.weight_g : 0) * o.line.quantity;
  const insideDhaka = address.district === "Dhaka";
  const delivery = deliveryCharge({ insideDhaka, weightGrams: weight }) * 100;
  const subtotal = unit * o.line.quantity;
  const status = o.status ?? "delivered";

  const existing = await prisma.order.findUnique({ where: { orderNo: o.orderNo }, select: { id: true, shopOrders: { select: { id: true, items: { select: { id: true } } } } } });
  if (existing) {
    // Keep the dates relative to today so the windows and timers stay as described above.
    await prisma.order.update({ where: { id: existing.id }, data: { placedAt, phoneVerifiedAt: placedAt } });
    const so = existing.shopOrders[0];
    await prisma.shopOrder.update({ where: { id: so.id }, data: { status, statusChangedAt: deliveredAt, deliveredAt, handoverDueAt: new Date(placedAt.getTime() + 48 * HOUR) } });
    return { orderId: existing.id, shopOrderId: so.id, shopId: shop.id, itemId: so.items[0].id, userId: o.guest ? null : customer.id, contactPhone: contact.phone, unitPrice: money(unit), deliveryCharge: money(delivery), deliveredAt };
  }
  const options = variant.options as Record<string, string>;
  const order = await prisma.order.create({
    data: {
      orderNo: o.orderNo,
      userId: o.guest ? null : customer.id,
      contactName: contact.name,
      contactPhone: contact.phone,
      phoneVerifiedAt: placedAt,
      contactEmail: contact.email,
      address,
      zone: insideDhaka ? "inside_dhaka" : "outside_dhaka",
      itemsSubtotal: money(subtotal),
      deliveryTotal: money(delivery),
      grandTotal: money(subtotal + delivery),
      paymentMethod: "cod",
      policyVersions: [
        { slug: "returns", version: 1 },
        { slug: "delivery", version: 1 },
        ...(o.guest ? [{ slug: "privacy", version: 1 }] : []),
      ],
      idempotencyKey: `seed:${o.orderNo}`,
      placedAt,
      smsSentAt: placedAt,
      emailSentAt: placedAt,
      shopOrders: {
        create: {
          shopId: shop.id,
          seq: 1,
          status,
          statusChangedAt: deliveredAt,
          shopName: shop.name,
          shopRegistration: shop.tier === "verified" && shop.registrationNo ? `Trade licence ${shop.registrationNo}` : null,
          itemsSubtotal: money(subtotal),
          weightGrams: weight,
          deliveryCharge: money(delivery),
          freeDelivery: false,
          total: money(subtotal + delivery),
          vatRate: "0.00",
          vatAmount: "0.00",
          commissionAmount: money(Math.round((subtotal * Number(product.category.commissionRate)) / 100)),
          launchOffer: false,
          handoverDueAt: new Date(placedAt.getTime() + 48 * HOUR),
          deliveredAt,
          items: {
            create: {
              productId: product.id,
              variantId: variant.id,
              categoryId: product.categoryId,
              title: product.title,
              variantLabel: Object.keys(options).length ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : null,
              sku: variant.sku,
              unitPrice: money(unit),
              quantity: o.line.quantity,
              lineTotal: money(subtotal),
              unitWeightGrams: weight / o.line.quantity,
              warranty: typeof attrs.warranty === "string" ? attrs.warranty : null,
              commissionRate: Number(product.category.commissionRate).toFixed(2),
              returnEligibility: typeof attrs.return_eligibility === "string" ? attrs.return_eligibility : null,
            },
          },
        },
      },
    },
    select: { id: true, shopOrders: { select: { id: true, items: { select: { id: true } } } } },
  });
  const so = order.shopOrders[0];
  return { orderId: order.id, shopOrderId: so.id, shopId: shop.id, itemId: so.items[0].id, userId: o.guest ? null : customer.id, contactPhone: contact.phone, unitPrice: money(unit), deliveryCharge: money(delivery), deliveredAt };
}

export async function seedReturnsAndComplaints(now = new Date()): Promise<void> {
  const placed = new Map<string, Placed>();
  for (const o of ORDERS) placed.set(o.orderNo, await ensureOrder(o, now));
  const p = (no: string) => placed.get(`BD-261001-${no}`)!;
  const ago = (h: number) => new Date(now.getTime() - h * HOUR);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecom.test" }, select: { id: true } });
  const staff = async (shopId: string) => (await prisma.shopMember.findFirstOrThrow({ where: { shopId, role: "staff" }, select: { userId: true } })).userId;

  // ---------- Returns: one in each main state ----------
  type R = { key: string; order: string; quantity: number; reason: "damaged" | "wrong_item" | "not_as_described" | "change_of_mind" | "other"; details: string; requestedHoursAgo: number; data: Record<string, unknown> };
  const returns: R[] = [
    { key: "requested", order: "RTNA2", quantity: 1, reason: "wrong_item", details: "[TEST] Ordered size M, received size L.", requestedHoursAgo: 2, data: { status: "requested" } },
    { key: "overdue", order: "RTNB3", quantity: 1, reason: "damaged", details: "[TEST] One RAM stick does not boot.", requestedHoursAgo: 50, data: { status: "requested" } },
    {
      key: "accepted",
      order: "RTNC4",
      quantity: 1,
      reason: "damaged",
      details: "[TEST] Pages torn in one copy.",
      requestedHoursAgo: 30,
      data: { status: "accepted", shopRespondedAt: ago(20), shopNote: "[TEST] Courier collects it on Sunday." },
    },
    {
      key: "disputed",
      order: "RTND5",
      quantity: 1,
      reason: "not_as_described",
      details: "[TEST] Colour is much lighter than the photos.",
      requestedHoursAgo: 60,
      data: { status: "escalated", shopRespondedAt: ago(40), shopNote: "[TEST] Colour matches the listing photos.", escalatedAt: ago(10), escalationReason: "customer_dispute", disputeNote: "[TEST] Photos attached show the difference." },
    },
    {
      key: "approved",
      order: "RTNE6",
      quantity: 1,
      reason: "damaged",
      details: "[TEST] Box crushed, stick bent.",
      requestedHoursAgo: 100,
      data: { status: "approved", escalatedAt: ago(52), escalationReason: "no_response", adminDecidedAt: ago(30), adminDecidedById: admin.id, adminNote: "[TEST] Shop did not answer; photos show damage." },
    },
    {
      key: "denied",
      order: "RTNF7",
      quantity: 1,
      reason: "other",
      details: "[TEST] Found it cheaper elsewhere.",
      requestedHoursAgo: 200,
      data: { status: "denied", shopRespondedAt: ago(190), shopNote: "[TEST] Not a valid return reason.", escalatedAt: ago(180), escalationReason: "customer_dispute", disputeNote: "[TEST] Please reconsider.", adminDecidedAt: ago(170), adminDecidedById: admin.id, adminNote: "[TEST] Price difference is not a return reason under the policy.", closedAt: ago(170) },
    },
    {
      key: "received",
      order: "RTNG8",
      quantity: 1,
      reason: "wrong_item",
      details: "[TEST] Received white instead of black.",
      requestedHoursAgo: 60,
      data: { status: "received", shopRespondedAt: ago(50), receivedAt: ago(5), restockedAt: ago(5) },
    },
    {
      key: "refunded",
      order: "RTNH9",
      quantity: 1,
      reason: "damaged",
      details: "[TEST] Dead on arrival.",
      requestedHoursAgo: 190,
      data: {
        status: "refunded",
        shopRespondedAt: ago(180),
        receivedAt: ago(120),
        refundAmount: (Number(p("RTNH9").unitPrice) + Number(p("RTNH9").deliveryCharge)).toFixed(2),
        refundDelivery: p("RTNH9").deliveryCharge,
        refundMethod: "bkash",
        refundReference: "TEST8N7A6B5C",
        refundedAt: ago(100),
        closedAt: ago(100),
      },
    },
  ];
  for (const r of returns) {
    const o = p(r.order);
    const createdAt = ago(r.requestedHoursAgo);
    const shopStaff = await staff(o.shopId);
    const data = {
      orderId: o.orderId,
      shopOrderId: o.shopOrderId,
      orderItemId: o.itemId,
      shopId: o.shopId,
      userId: o.userId,
      contactPhone: o.contactPhone,
      quantity: r.quantity,
      reason: r.reason,
      details: r.details,
      photoKeys: [] as string[],
      policyVersion: 1,
      shopDueAt: new Date(createdAt.getTime() + 48 * HOUR),
      createdAt,
      statusChangedAt: ago(Math.max(0, r.requestedHoursAgo - 1)),
      // Reset fields a re-run could have changed (seed state wins).
      shopRespondedAt: null,
      shopNote: null,
      escalatedAt: null,
      escalationReason: null,
      disputeNote: null,
      adminDecidedAt: null,
      adminDecidedById: null,
      adminNote: null,
      receivedAt: null,
      restockedAt: null,
      refundAmount: null,
      refundDelivery: null,
      refundMethod: null,
      refundReference: null,
      refundedAt: null,
      refundedById: r.key === "refunded" ? shopStaff : null,
      closedAt: null,
      ...r.data,
    };
    const id = `seed-return-${r.key}`;
    await prisma.returnRequest.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ---------- Complaints: open, in progress, resolved, and one overdue ----------
  type C = { key: string; ticketNo: string; order: string; subject: string; category: "delivery" | "product" | "return_refund" | "shop_conduct" | "other"; openedHoursAgo: number; status: "open" | "in_progress" | "resolved" | "closed"; resolution?: string; messages: [("customer" | "shop" | "admin"), string][] };
  const complaints: C[] = [
    { key: "open", ticketNo: "CP-261001-TKTA2", order: "RTNA2", subject: "[TEST] Wrong size delivered", category: "product", openedHoursAgo: 1, status: "open", messages: [["customer", "[TEST] I got size L instead of M. I also asked for a return."]] },
    {
      key: "in-progress",
      ticketNo: "CP-261001-TKTB3",
      order: "RTNC4",
      subject: "[TEST] When will the courier collect the book?",
      category: "return_refund",
      openedHoursAgo: 30,
      status: "in_progress",
      messages: [
        ["customer", "[TEST] The shop accepted my return. When is the pickup?"],
        ["shop", "[TEST] Our courier will come on Sunday between 10 am and 2 pm."],
      ],
    },
    {
      key: "overdue",
      ticketNo: "CP-261001-TKTC4",
      order: "RTNK3",
      subject: "[TEST] One copy has missing pages",
      category: "product",
      openedHoursAgo: 80,
      status: "open",
      messages: [["customer", "[TEST] Pages 40 to 56 are missing. The return window closed while I was travelling."]],
    },
    {
      key: "resolved",
      ticketNo: "CP-261001-TKTD5",
      order: "RTNH9",
      subject: "[TEST] Refund not received yet",
      category: "return_refund",
      openedHoursAgo: 150,
      status: "resolved",
      resolution: "[TEST] The shop paid the refund by bKash (reference TEST8N7A6B5C).",
      messages: [
        ["customer", "[TEST] The shop received the RAM but I have no refund yet."],
        ["admin", "[TEST] We asked the shop to pay today."],
      ],
    },
  ];
  for (const c of complaints) {
    const o = p(c.order);
    const createdAt = ago(c.openedHoursAgo);
    const dueAt = new Date(createdAt.getTime() + 72 * HOUR);
    const resolvedAt = c.status === "resolved" ? ago(c.openedHoursAgo - 20) : null;
    const data = {
      ticketNo: c.ticketNo,
      userId: o.userId,
      contactPhone: o.contactPhone,
      contactEmail: "customer.verified@ecom.test",
      orderId: o.orderId,
      shopOrderId: o.shopOrderId,
      shopId: o.shopId,
      subject: c.subject,
      category: c.category,
      status: c.status,
      statusChangedAt: resolvedAt ?? (c.status === "in_progress" ? ago(c.openedHoursAgo - 2) : createdAt),
      dueAt,
      // The overdue one is left unflagged so the complaints.flag-overdue job flags it.
      overdueAt: null,
      resolvedAt,
      resolution: c.resolution ?? null,
      resolvedById: resolvedAt ? admin.id : null,
      createdAt,
    };
    const id = `seed-complaint-${c.key}`;
    await prisma.complaintTicket.upsert({ where: { id }, update: data, create: { id, ...data } });
    const shopStaff = await staff(o.shopId);
    for (const [i, [role, text]] of c.messages.entries()) {
      const mid = `${id}-m${i + 1}`;
      const msg = { ticketId: id, authorRole: role, authorId: role === "customer" ? o.userId : role === "shop" ? shopStaff : admin.id, text, createdAt: new Date(createdAt.getTime() + i * 2 * HOUR) };
      await prisma.complaintMessage.upsert({ where: { id: mid }, update: msg, create: { id: mid, ...msg } });
    }
  }

  console.info(
    `Seeded ${ORDERS.length} delivered orders with ${returns.length} returns (one per state; the RTNB3 request is past its 48 h) and ${complaints.length} complaints (CP-261001-TKTC4 is past its 72 h). ` +
      "Medicine exclusion: BD-261001-RTNJ2; closed 7-day window: BD-261001-RTNK3.",
  );
}
