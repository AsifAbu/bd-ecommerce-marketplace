import { cookies } from "next/headers";
import { addressRepo, otpService } from "@/features/accounts/server";
import { cartService, currentUserOrNull, resolveCartOwner } from "@/features/cart/server";
import {
  assertAcceptedCurrent,
  CHECKOUT_POLICY_SLUGS,
  getCurrentVersions,
  GUEST_CHECKOUT_POLICY_SLUGS,
  PolicyError,
  recordAcceptance,
  requestMeta,
  type PolicySlug,
} from "@/features/policies";
import { notifyProductsChanged } from "@/features/search";
import { prisma } from "@/lib/db";
import { sendJob } from "@/lib/jobs/boss";
import { appUrl, sendMail } from "@/lib/mail";
import { createSmsProvider } from "@/lib/sms";
import { createOrdersApi, ORDER_ACCESS_COOKIE, type ApiUser } from "./api";
import { getOrderConfig } from "./config";
import { OrderError } from "./errors";
import { linkGuestOrders } from "./linking";
import { sendOrderConfirmation } from "./notify";
import { generateOrderNo } from "./order-no";
import { createOrderOtp } from "./otp";
import { createPlacementService } from "./placement";
import * as repo from "./repo";
import { addOrderGrant, hasOrderGrant, readPhoneProof } from "./tokens";
import { toAddress, toOrderView, type OrderView } from "./views";

/**
 * The orders feature wired to Prisma, cookies, the session, the cart, policies, OTP, jobs, SMS and
 * email. Route handlers, pages, the worker and the Auth.js events use these.
 */

const secret = () => process.env.AUTH_SECRET ?? "";
const secureCookies = () => (process.env.AUTH_URL ?? "").startsWith("https://");

/** Policy errors use the policies feature's own class; checkout answers them in its shape. */
async function policyCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PolicyError) throw new OrderError(err.status, err.code, err.message, err.fields);
    throw err;
  }
}

export const placementService = createPlacementService({
  config: getOrderConfig(),
  now: () => new Date(),
  newOrderNo: (now) => generateOrderNo(now),
  getCart: (owner, zone) => cartService.getCart(owner, zone),
  store: repo,
  slugs: { account: CHECKOUT_POLICY_SLUGS, guest: GUEST_CHECKOUT_POLICY_SLUGS },
  policies: {
    recordAcceptance: (input) =>
      policyCall(() =>
        recordAcceptance({
          userId: input.userId,
          guestPhone: input.guestPhone,
          slugs: input.slugs as readonly PolicySlug[],
          context: "checkout",
          shownVersions: input.shownVersions as Partial<Record<PolicySlug, number>>,
          ip: input.ip,
          userAgent: input.userAgent,
        }),
      ),
    assertAcceptedCurrent: (userId, slugs) => policyCall(() => assertAcceptedCurrent(userId, slugs as readonly PolicySlug[])),
    getCurrentVersions: (slugs) => policyCall(() => getCurrentVersions(slugs as readonly PolicySlug[])),
  },
  // Retried with backoff (about 1, 2, 4… minutes) until the SMS and the email are both sent.
  enqueueNotification: (orderId) => sendJob("orders.notify-placed", { orderId }, { retryLimit: 8, retryDelay: 60, retryBackoff: true }),
  onStockChanged: notifyProductsChanged,
});

/** US-009: attach guest orders to this account by its verified mobile or email. Never throws. */
export async function linkGuestOrdersFor(userId: string | undefined | null): Promise<void> {
  if (!userId) return;
  try {
    const result = await linkGuestOrders(userId, { findUser: repo.findUserIdentifiers, attach: repo.attachGuestOrders, now: () => new Date() });
    if (result.byPhone || result.byEmail) console.info("[orders] guest orders linked", { userId, ...result });
  } catch (err) {
    console.error("[orders] linking guest orders failed", err);
  }
}

export const orderOtp = createOrderOtp({
  otp: otpService,
  get secret() {
    return secret();
  },
  now: () => new Date(),
  orderAccessTtlMs: getOrderConfig().orderAccessTtlMs,
  accountUsesPhone: async (phone) => (await prisma.user.count({ where: { phone } })) > 0,
  async markAccountPhoneVerified(userId, phone) {
    await prisma.user.updateMany({ where: { id: userId, phone, phoneVerifiedAt: null }, data: { phoneVerifiedAt: new Date() } });
  },
  linkGuestOrders: linkGuestOrdersFor,
  findOrderPhone: repo.findOrderPhone,
});

async function currentApiUser(): Promise<ApiUser | null> {
  const user = await currentUserOrNull();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, phone: true, phoneVerifiedAt: true, email: true },
  });
}

const cookieJar = {
  async get(name: string) {
    return (await cookies()).get(name)?.value;
  },
  async set(name: string, value: string, maxAgeSec: number) {
    (await cookies()).set(name, value, { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", maxAge: maxAgeSec });
  },
};

export const ordersApi = createOrdersApi({
  currentUser: currentApiUser,
  cartOwner: () => resolveCartOwner({ writable: true }),
  addresses: {
    async get(userId, id) {
      const a = await prisma.address.findFirst({ where: { id, userId } });
      return a ? toAddress(a) : null;
    },
    create: (userId, input) => addressRepo.create(userId, input),
  },
  placement: placementService,
  otp: orderOtp,
  cookies: cookieJar,
  meta: requestMeta,
  readPhoneProof: (value) => readPhoneProof(secret(), value, new Date(), getOrderConfig().phoneProofTtlMs),
  hasGrant: (value, orderNo) => hasOrderGrant(secret(), value, orderNo, new Date()),
  addGrant: (value, orderNo) => addOrderGrant(secret(), value, orderNo, new Date(), getOrderConfig().orderAccessTtlMs),
  phoneProofMaxAgeSec: getOrderConfig().phoneProofTtlMs / 1000,
  orderAccessMaxAgeSec: getOrderConfig().orderAccessTtlMs / 1000,
  orders: { listForUser: (userId) => repo.listOrdersForUser(userId), getForUser: repo.getOrderForUser, getByNo: repo.getOrderByNo },
});

/** For pages: the order this request may see (own order, or a guest grant), or null. */
export const viewableOrder = (orderNo: string) => ordersApi.viewableOrder(orderNo.toUpperCase());

/** My orders (US-052), newest first. */
export async function ordersOfUser(userId: string): Promise<OrderView[]> {
  return (await repo.listOrdersForUser(userId)).map(toOrderView);
}

/**
 * The order behind an invoice for one shop order: the customer (own order or grant) or a member
 * of that shop (the seller prints the bill for the parcel). Null when not allowed or not found.
 */
export async function invoiceOrder(orderNo: string, shopOrderId: string, shopMemberOf: (shopId: string) => Promise<boolean>): Promise<OrderView | null> {
  const asCustomer = await viewableOrder(orderNo);
  if (asCustomer) return asCustomer.shopOrders.some((so) => so.id === shopOrderId) ? asCustomer : null;
  const shopOrder = await prisma.shopOrder.findFirst({ where: { id: shopOrderId, order: { orderNo: orderNo.toUpperCase() } }, select: { shopId: true } });
  if (!shopOrder || !(await shopMemberOf(shopOrder.shopId))) return null;
  const scoped = await repo.getShopOrderForShop(shopOrder.shopId, shopOrderId);
  if (!scoped) return null;
  // A seller sees only its own shop order on the invoice.
  const view = toOrderView(scoped.order);
  return { ...view, shopOrders: view.shopOrders.filter((so) => so.id === shopOrderId) };
}

/** Seller side (Sprint 6 minimal list): the shop's orders, scoped by the guard-checked shopId. */
export const shopOrdersOf = (shopId: string, status?: string) => repo.listShopOrders(shopId, { status });

/** The job handler: one SMS and one email invoice for the order. */
export function notifyOrderPlaced(orderId: string) {
  const sms = createSmsProvider();
  return sendOrderConfirmation(orderId, {
    async load(id) {
      const row = await repo.getOrderForNotification(id);
      if (!row) return null;
      return { ...toOrderView(row), contactPhoneE164: row.contactPhone, smsSentAt: row.smsSentAt, emailSentAt: row.emailSentAt };
    },
    sendSms: (phone, text) => sms.send(phone, text),
    sendMail,
    markSent: repo.markNotified,
    trackUrl: (orderNo) => appUrl(`/track?orderNo=${encodeURIComponent(orderNo)}`),
    now: () => new Date(),
  });
}

export { ORDER_ACCESS_COOKIE };
