import { STATUS_LABELS, isOpenStatus, type ShopOrderStatus } from "./config";
import type { AddressSnapshot } from "./draft";
import { shopOrderNo } from "./order-no";

/**
 * Plain view models of stored orders for pages, the JSON API, invoices and notifications
 * (Decimals become numbers in Tk). Pure.
 */

type Money = { toString(): string } | number | string;
const tk = (m: Money) => Number(m.toString());

export interface OrderItemView {
  id: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  warranty: string | null;
}

export interface ShopOrderView {
  id: string;
  shopId: string;
  shopOrderNo: string;
  shopName: string;
  shopHref: string | null;
  shopRegistration: string | null;
  status: ShopOrderStatus;
  statusLabel: string;
  statusChangedAt: string;
  itemsSubtotal: number;
  weightGrams: number;
  deliveryCharge: number;
  freeDelivery: boolean;
  total: number;
  vatRate: number;
  vatAmount: number;
  handoverDueAt: string;
  cancelReason: string | null;
  deliveredAt: string | null;
  items: OrderItemView[];
}

export interface OrderView {
  id: string;
  orderNo: string;
  placedAt: string;
  contactName: string;
  /** 01XXXXXXXXX */
  contactPhone: string;
  contactEmail: string | null;
  address: AddressSnapshot;
  zone: "inside_dhaka" | "outside_dhaka";
  itemsSubtotal: number;
  deliveryTotal: number;
  grandTotal: number;
  paymentMethod: "cod";
  /** "Open" while any shop order is open, else the shared final status, else "Completed". */
  summaryStatus: string;
  shopOrders: ShopOrderView[];
}

export interface OrderRowLike {
  id: string;
  orderNo: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  address: unknown;
  zone: "inside_dhaka" | "outside_dhaka";
  itemsSubtotal: Money;
  deliveryTotal: Money;
  grandTotal: Money;
  paymentMethod: "cod";
  placedAt: Date;
  shopOrders: {
    id: string;
    shopId: string;
    seq: number;
    status: ShopOrderStatus;
    statusChangedAt: Date;
    shopName: string;
    shopRegistration: string | null;
    itemsSubtotal: Money;
    weightGrams: number;
    deliveryCharge: Money;
    freeDelivery: boolean;
    total: Money;
    vatRate: Money;
    vatAmount: Money;
    handoverDueAt: Date;
    cancelReason: string | null;
    deliveredAt: Date | null;
    shop?: { slug: string } | null;
    items: {
      id: string;
      productId: string;
      title: string;
      variantLabel: string | null;
      sku: string | null;
      unitPrice: Money;
      quantity: number;
      lineTotal: Money;
      warranty: string | null;
    }[];
  }[];
}

export const localPhone = (phone: string) => phone.replace(/^\+88/, "");

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function toAddress(value: unknown): AddressSnapshot {
  const a = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    name: str(a.name),
    phone: str(a.phone),
    division: str(a.division),
    district: str(a.district),
    upazila: str(a.upazila),
    area: str(a.area),
    line1: str(a.line1),
  };
}

export function summaryStatus(statuses: readonly string[]): string {
  if (statuses.some(isOpenStatus)) return "Open";
  const unique = [...new Set(statuses)];
  if (unique.length === 1) return STATUS_LABELS[unique[0] as ShopOrderStatus] ?? unique[0];
  return "Completed";
}

export function toOrderView(row: OrderRowLike): OrderView {
  return {
    id: row.id,
    orderNo: row.orderNo,
    placedAt: row.placedAt.toISOString(),
    contactName: row.contactName,
    contactPhone: localPhone(row.contactPhone),
    contactEmail: row.contactEmail,
    address: toAddress(row.address),
    zone: row.zone,
    itemsSubtotal: tk(row.itemsSubtotal),
    deliveryTotal: tk(row.deliveryTotal),
    grandTotal: tk(row.grandTotal),
    paymentMethod: row.paymentMethod,
    summaryStatus: summaryStatus(row.shopOrders.map((s) => s.status)),
    shopOrders: row.shopOrders.map((so) => ({
      id: so.id,
      shopId: so.shopId,
      shopOrderNo: shopOrderNo(row.orderNo, so.seq),
      shopName: so.shopName,
      shopHref: so.shop?.slug ? `/s/${so.shop.slug}` : null,
      shopRegistration: so.shopRegistration,
      status: so.status,
      statusLabel: STATUS_LABELS[so.status] ?? so.status,
      statusChangedAt: so.statusChangedAt.toISOString(),
      itemsSubtotal: tk(so.itemsSubtotal),
      weightGrams: so.weightGrams,
      deliveryCharge: tk(so.deliveryCharge),
      freeDelivery: so.freeDelivery,
      total: tk(so.total),
      vatRate: tk(so.vatRate),
      vatAmount: tk(so.vatAmount),
      handoverDueAt: so.handoverDueAt.toISOString(),
      cancelReason: so.cancelReason,
      deliveredAt: so.deliveredAt?.toISOString() ?? null,
      items: so.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        title: i.title,
        variantLabel: i.variantLabel,
        sku: i.sku,
        unitPrice: tk(i.unitPrice),
        quantity: i.quantity,
        lineTotal: tk(i.lineTotal),
        warranty: i.warranty,
      })),
    })),
  };
}

/** "Tk 1,850" (two decimals only when needed). */
export function formatTk(value: number): string {
  return `Tk ${value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "17 Oct 2026, 3:05 pm" in Bangladesh time. */
export function formatDhakaTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const formatAddress = (a: AddressSnapshot) => [a.line1, a.area, a.upazila, a.district, a.division].filter(Boolean).join(", ");
