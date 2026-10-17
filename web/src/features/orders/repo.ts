import { cartOwnerWhere, type CartOwner } from "@/features/cart";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { DELIVERED_STATUSES, OPEN_STATUSES } from "./config";
import type { ItemFacts, OrderDraft, ShopFacts } from "./draft";
import type { CodHistory } from "./limits";
import { DuplicateSubmitError, OrderNoTakenError, StockConflictError, type PlacedOrder } from "./placement";

/**
 * Orders data access. Customer reads take the userId first and filter by it; shop reads take the
 * shopId first (ADR-004). Orders, shop orders and items are never deleted (6-year records).
 */

const REGISTRATION_LABELS: Record<string, string> = {
  trade_licence: "Trade licence",
  vat: "VAT registration (BIN)",
  tin: "TIN",
  ubid: "UBID",
  pra: "PRA",
  dbid: "DBID",
};

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// ---------- Placement (PlacementStore) ----------

export function findByIdempotencyKey(key: string): Promise<PlacedOrder | null> {
  return prisma.order.findUnique({ where: { idempotencyKey: key }, select: { id: true, orderNo: true, userId: true } });
}

/** Orders of this mobile (guest or account) and of the account itself. */
function historyWhere(phone: string, userId: string | null): Prisma.OrderWhereInput {
  return { OR: [{ contactPhone: phone }, ...(userId ? [{ userId }] : [])] };
}

export async function codHistory(phone: string, userId: string | null): Promise<CodHistory> {
  const order = historyWhere(phone, userId);
  const [open, delivered, refused] = await Promise.all([
    prisma.shopOrder.findMany({ where: { status: { in: [...OPEN_STATUSES] }, order }, select: { orderId: true } }),
    prisma.shopOrder.count({ where: { status: { in: [...DELIVERED_STATUSES] }, order } }),
    prisma.shopOrder.count({ where: { status: "refused", order } }),
  ]);
  // An order with two open shop orders is one open order.
  return { openOrders: new Set(open.map((s) => s.orderId)).size, delivered, refused };
}

export async function shopFacts(shopIds: string[]): Promise<Map<string, ShopFacts & { openOrders: number; maxOpenOrders: number | null }>> {
  const shops = await prisma.shop.findMany({
    where: { id: { in: shopIds } },
    select: { id: true, name: true, tier: true, registrationType: true, registrationNo: true },
  });
  const map = new Map<string, ShopFacts & { openOrders: number; maxOpenOrders: number | null }>();
  for (const s of shops) {
    const openOrders = await prisma.shopOrder.count({ where: { shopId: s.id, status: { in: [...OPEN_STATUSES] } } });
    const registration =
      s.tier === "verified" && s.registrationType && s.registrationNo
        ? `${REGISTRATION_LABELS[s.registrationType] ?? s.registrationType} ${s.registrationNo}`
        : null;
    map.set(s.id, { name: s.name, tier: s.tier, registration, openOrders, maxOpenOrders: TIER_LIMITS[s.tier].maxOpenOrders });
  }
  return map;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function itemFacts(variantIds: string[]): Promise<Map<string, ItemFacts>> {
  const rows = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      product: { select: { categoryId: true, attributes: true, category: { select: { commissionRate: true } } } },
    },
  });
  return new Map(
    rows.map((v) => {
      const warranty = isRecord(v.product.attributes) ? v.product.attributes.warranty : undefined;
      return [
        v.id,
        {
          sku: v.sku,
          warranty: typeof warranty === "string" && warranty.trim() ? warranty.trim() : null,
          categoryId: v.product.categoryId,
          commissionRate: Number(v.product.category.commissionRate.toString()),
        },
      ];
    }),
  );
}

export function findAccountByVerifiedPhone(phone: string) {
  return prisma.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, status: "active" }, select: { id: true } });
}

/**
 * The order transaction: each variant's stock is lowered only if enough is left at the price the
 * customer saw (`stock >= qty AND price = unit price`), else StockConflictError and nothing is
 * written. Then the order, one shop order per shop with its items, and the ordered cart lines go.
 * Variants are locked in id order so two checkouts never deadlock.
 */
export async function place(draft: OrderDraft, owner: CartOwner, cartItemIds: string[]): Promise<PlacedOrder> {
  try {
    return await prisma.$transaction(async (tx) => {
      const items = draft.shopOrders.flatMap((so) => so.items).sort((a, b) => a.variantId.localeCompare(b.variantId));
      for (const item of items) {
        const { count } = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity }, price: item.unitPrice },
          data: { stock: { decrement: item.quantity } },
        });
        if (count !== 1) {
          const now = await tx.productVariant.findFirst({ where: { id: item.variantId }, select: { stock: true } });
          const reason = !now ? "gone" : now.stock >= item.quantity ? "price" : "stock";
          throw new StockConflictError(item.variantId, item.title, Math.max(0, now?.stock ?? 0), reason);
        }
      }

      const order = await tx.order.create({
        data: {
          orderNo: draft.orderNo,
          userId: draft.userId,
          linkedVia: draft.linkedVia,
          linkedAt: draft.linkedVia ? draft.placedAt : null,
          contactName: draft.contactName,
          contactPhone: draft.contactPhone,
          phoneVerifiedAt: draft.phoneVerifiedAt,
          contactEmail: draft.contactEmail,
          address: { ...draft.address },
          zone: draft.zone,
          itemsSubtotal: draft.itemsSubtotal,
          deliveryTotal: draft.deliveryTotal,
          grandTotal: draft.grandTotal,
          paymentMethod: "cod",
          policyVersions: draft.policyVersions,
          idempotencyKey: draft.idempotencyKey,
          placedAt: draft.placedAt,
          shopOrders: {
            create: draft.shopOrders.map((so) => ({
              shopId: so.shopId,
              seq: so.seq,
              status: "placed" as const,
              statusChangedAt: draft.placedAt,
              shopName: so.shopName,
              shopRegistration: so.shopRegistration,
              itemsSubtotal: so.itemsSubtotal,
              weightGrams: so.weightGrams,
              deliveryCharge: so.deliveryCharge,
              freeDelivery: so.freeDelivery,
              total: so.total,
              vatRate: so.vatRate,
              vatAmount: so.vatAmount,
              commissionAmount: so.commissionAmount,
              launchOffer: so.launchOffer,
              handoverDueAt: so.handoverDueAt,
              items: {
                create: so.items.map((i) => ({
                  productId: i.productId,
                  variantId: i.variantId,
                  categoryId: i.categoryId,
                  title: i.title,
                  variantLabel: i.variantLabel,
                  sku: i.sku,
                  unitPrice: i.unitPrice,
                  quantity: i.quantity,
                  lineTotal: i.lineTotal,
                  unitWeightGrams: i.unitWeightGrams,
                  warranty: i.warranty,
                  commissionRate: i.commissionRate,
                })),
              },
            })),
          },
        },
        select: { id: true, orderNo: true, userId: true },
      });

      if (cartItemIds.length) {
        await tx.cartItem.deleteMany({ where: { ...cartOwnerWhere(owner), id: { in: cartItemIds } } });
      }
      return order;
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    if (await findByIdempotencyKey(draft.idempotencyKey)) throw new DuplicateSubmitError();
    throw new OrderNoTakenError();
  }
}

// ---------- Customer reads (scoped by userId) ----------

const itemSelect = {
  id: true,
  productId: true,
  variantId: true,
  title: true,
  variantLabel: true,
  sku: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
  warranty: true,
} satisfies Prisma.OrderItemSelect;

const shopOrderSelect = {
  id: true,
  shopId: true,
  seq: true,
  status: true,
  statusChangedAt: true,
  shopName: true,
  shopRegistration: true,
  itemsSubtotal: true,
  weightGrams: true,
  deliveryCharge: true,
  freeDelivery: true,
  total: true,
  vatRate: true,
  vatAmount: true,
  handoverDueAt: true,
  cancelReason: true,
  deliveredAt: true,
  shop: { select: { slug: true } },
  items: { select: itemSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ShopOrderSelect;

export const orderSelect = {
  id: true,
  orderNo: true,
  userId: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  address: true,
  zone: true,
  itemsSubtotal: true,
  deliveryTotal: true,
  grandTotal: true,
  paymentMethod: true,
  policyVersions: true,
  placedAt: true,
  shopOrders: { select: shopOrderSelect, orderBy: { seq: "asc" } },
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

/** The user's orders, newest first (My orders). */
export function listOrdersForUser(userId: string, take = 50): Promise<OrderRow[]> {
  return prisma.order.findMany({ where: { userId }, select: orderSelect, orderBy: { placedAt: "desc" }, take });
}

/** One of the user's orders; null when it is someone else's or a guest's. */
export function getOrderForUser(userId: string, orderNo: string): Promise<OrderRow | null> {
  return prisma.order.findFirst({ where: { userId, orderNo }, select: orderSelect });
}

/**
 * An order by number, for a browser holding a signed grant for it (guest after checkout or
 * tracking). Callers check the grant first.
 */
export function getOrderByNo(orderNo: string): Promise<OrderRow | null> {
  return prisma.order.findFirst({ where: { orderNo }, select: orderSelect });
}

/** The mobile the order was placed with (tracking OTP goes there). */
export function findOrderPhone(orderNo: string) {
  return prisma.order.findFirst({ where: { orderNo }, select: { id: true, contactPhone: true } });
}

// ---------- Shop reads (scoped by shopId, ADR-004) ----------

export const sellerShopOrderSelect = {
  id: true,
  seq: true,
  status: true,
  statusChangedAt: true,
  itemsSubtotal: true,
  deliveryCharge: true,
  total: true,
  handoverDueAt: true,
  createdAt: true,
  order: { select: { orderNo: true, contactName: true, zone: true, address: true, placedAt: true } },
  items: { select: { id: true, title: true, variantLabel: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } },
} satisfies Prisma.ShopOrderSelect;

export type SellerShopOrderRow = Prisma.ShopOrderGetPayload<{ select: typeof sellerShopOrderSelect }>;

/** The shop's orders, newest first. Only shop orders of `shopId`. */
export function listShopOrders(shopId: string, opts: { status?: string; take?: number } = {}): Promise<SellerShopOrderRow[]> {
  return prisma.shopOrder.findMany({
    where: { shopId, ...(opts.status ? { status: opts.status as never } : {}) },
    select: sellerShopOrderSelect,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
  });
}

/** One shop order of this shop (null for another shop's), with its customer order for the invoice. */
export function getShopOrderForShop(shopId: string, shopOrderId: string) {
  return prisma.shopOrder.findFirst({ where: { id: shopOrderId, shopId }, select: { id: true, order: { select: orderSelect } } });
}

// ---------- Linking guest orders (US-009) ----------

export function findUserIdentifiers(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, phoneVerifiedAt: true, email: true, emailVerifiedAt: true, status: true },
  });
}

/** Attaches guest orders (no user yet) placed with this mobile or email. Returns how many. */
export async function attachGuestOrders(userId: string, by: { contactPhone: string } | { contactEmail: string }, via: string, at: Date) {
  const { count } = await prisma.order.updateMany({ where: { userId: null, ...by }, data: { userId, linkedVia: via, linkedAt: at } });
  return count;
}

// ---------- Notifications ----------

export function getOrderForNotification(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, select: { ...orderSelect, smsSentAt: true, emailSentAt: true } });
}

export async function markNotified(orderId: string, channel: "sms" | "email", at: Date) {
  await prisma.order.updateMany({ where: { id: orderId }, data: channel === "sms" ? { smsSentAt: at } : { emailSentAt: at } });
}
