import { randomUUID } from "node:crypto";
import { viewableOrder } from "@/features/orders/server";
import { requirePlatformAdmin, requireShopRole, requireUser, UnauthorizedError } from "@/lib/auth";
import { isTestMode } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendJob } from "@/lib/jobs/boss";
import { appUrl, sendMail } from "@/lib/mail";
import { createSmsProvider } from "@/lib/sms";
import { getStorage } from "@/lib/storage";
import { createReturnsApi } from "./api";
import { sendReturnNotification } from "./notify";
import * as repo from "./repo";
import { REASON_LABELS, REFUND_METHOD_LABELS, type ReturnStatus } from "./rules";
import { createReturnsService, type ReturnEvent, type ReturnScope } from "./service";
import { toReturnView, type ReturnView } from "./views";

/**
 * The returns feature wired to Prisma, the session, the order grant, storage, jobs, SMS and email.
 * Route handlers, pages, server actions and the worker use these.
 */

export const returnsService = createReturnsService({
  store: repo,
  photos: {
    get testMode() {
      return isTestMode();
    },
    newKey: (ext) => `returns/${randomUUID()}${ext}`,
    putObject: (key, body, type) => getStorage().putObject(key, body, type),
  },
  now: () => new Date(),
  notify: (returnId, event) => sendJob("returns.notify", { returnId, event }, { retryLimit: 5, retryDelay: 60, retryBackoff: true }),
});

/** The logged-in user's id, or null for a guest. */
export async function currentUserId(): Promise<string | null> {
  try {
    return (await requireUser()).id;
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

/** The order this request may open (own order or guest grant), as { id, orderNo }. */
export async function customerOrder(orderNo: string): Promise<{ id: string; orderNo: string } | null> {
  const order = await viewableOrder(orderNo);
  return order ? { id: order.id, orderNo: order.orderNo } : null;
}

export const returnsApi = createReturnsApi({
  currentUserId,
  customerOrder,
  async requireShop(shopId) {
    const access = await requireShopRole(shopId, ["owner", "staff"]);
    return { shopId: access.shopId, userId: access.user.id };
  },
  requireAdmin: () => requirePlatformAdmin(),
  service: returnsService,
  rows: {
    forUser: (userId) => repo.listForUser(userId),
    forOrder: (orderId) => repo.listForOrder(orderId),
    forShop: (shopId, status) => repo.listForShop(shopId, { status }),
    forAdmin: (status) => repo.listForAdmin({ status }),
    get: repo.getRow,
    orderNoOf: repo.orderNoOf,
  },
  now: () => new Date(),
});

// ---------- Pages ----------

const views = async (rows: repo.ReturnRow[]): Promise<ReturnView[]> => {
  const now = new Date();
  return Promise.all(
    rows.map(async (r) => toReturnView(r, now, r.status === "refunded" ? false : await repo.deliveryAlreadyRefunded(r.shopOrder.id, r.id))),
  );
};

export const returnsOfUser = async (userId: string) => views(await repo.listForUser(userId));
export const returnsOfOrder = async (orderId: string) => views(await repo.listForOrder(orderId));
/** Seller page: pass the guard-checked shopId. */
export const returnsOfShop = async (shopId: string, status?: ReturnStatus) => views(await repo.listForShop(shopId, { status }));
/** Admin page: escalated by default. Call requirePlatformAdmin() first. */
export const returnsForAdmin = async (status?: ReturnStatus) => views(await repo.listForAdmin({ status }));

/** Signed links to a request's photos, for the shop (scoped) or the admin. Empty when storage is unavailable. */
export async function returnPhotoUrls(scope: ReturnScope, id: string): Promise<string[]> {
  const row = await prisma.returnRequest.findFirst({ where: { id, ...repo.scopeWhere(scope) }, select: { photoKeys: true } });
  if (!row?.photoKeys.length) return [];
  try {
    const storage = getStorage();
    return await Promise.all(row.photoKeys.map((k) => storage.getSignedUrl(k)));
  } catch (err) {
    console.error("[returns] photo links unavailable", err);
    return [];
  }
}

// ---------- Worker ----------

/** The returns.escalate-overdue job. */
export const escalateOverdueReturns = () => returnsService.escalateOverdue();

/** The returns.notify job. */
export function notifyReturn(returnId: string, event: ReturnEvent) {
  const sms = createSmsProvider();
  return sendReturnNotification(returnId, event, {
    async load(id) {
      const r = await prisma.returnRequest.findUnique({
        where: { id },
        select: {
          shopId: true,
          quantity: true,
          reason: true,
          shopNote: true,
          adminNote: true,
          escalationReason: true,
          refundAmount: true,
          refundMethod: true,
          refundReference: true,
          order: { select: { orderNo: true, contactName: true, contactPhone: true, contactEmail: true, user: { select: { email: true } } } },
          shopOrder: { select: { seq: true, shopName: true } },
          orderItem: { select: { title: true } },
          shop: { select: { members: { select: { user: { select: { email: true } } } } } },
        },
      });
      if (!r) return null;
      const admins = await prisma.user.findMany({ where: { isPlatformAdmin: true, status: "active", email: { not: null } }, select: { email: true } });
      const emails = (list: { email: string | null }[]) => [...new Set(list.map((u) => u.email).filter((e): e is string => !!e))];
      return {
        orderNo: r.order.orderNo,
        shopOrderNo: `${r.order.orderNo}-${r.shopOrder.seq}`,
        itemTitle: r.orderItem.title,
        quantity: r.quantity,
        reasonLabel: REASON_LABELS[r.reason],
        shopName: r.shopOrder.shopName,
        shopNote: r.shopNote,
        adminNote: r.adminNote,
        escalationReason: r.escalationReason,
        refund:
          r.refundAmount && r.refundMethod
            ? { amount: r.refundAmount.toFixed(2), methodLabel: REFUND_METHOD_LABELS[r.refundMethod], reference: r.refundReference ?? "" }
            : null,
        customer: { name: r.order.contactName, phone: r.order.contactPhone, email: r.order.contactEmail ?? r.order.user?.email ?? null },
        shopEmails: emails(r.shop.members.map((m) => m.user)),
        adminEmails: emails(admins),
        orderUrl: appUrl(`/orders/${r.order.orderNo}`),
        sellerUrl: appUrl(`/seller/${r.shopId}/returns`),
        adminUrl: appUrl("/admin/returns"),
      };
    },
    sendSms: (phone, text) => sms.send(phone, text),
    sendMail,
  });
}

// ---------- Figures for other features ----------

/** Payouts (US-082): refunds recorded per shop order of a shop, to deduct from the payout. */
export const refundsByShopOrder = repo.refundsByShopOrder;
/** Seller score (US-059) with shopId, marketplace metrics (US-083) without: return rate and refunds. */
export const returnStats = repo.returnStats;
