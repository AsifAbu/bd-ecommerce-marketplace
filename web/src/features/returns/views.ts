import {
  assertCanDispute,
  defaultRestock,
  REASON_LABELS,
  REFUND_METHOD_LABELS,
  refundLimit,
  RETURN_STATUS_LABELS,
  type RefundLimit,
  type RefundMethod,
  type ReturnReason,
  type ReturnStatus,
} from "./rules";

/** Plain view of a stored return request for pages and the JSON API (Decimals become Tk numbers). Pure. */

type Money = { toString(): string } | number | string;

export interface ReturnRowLike {
  id: string;
  quantity: number;
  reason: ReturnReason;
  details: string | null;
  photoKeys: string[];
  policyVersion: number | null;
  status: ReturnStatus;
  statusChangedAt: Date;
  shopDueAt: Date;
  shopRespondedAt: Date | null;
  shopNote: string | null;
  escalatedAt: Date | null;
  escalationReason: string | null;
  disputeNote: string | null;
  adminDecidedAt: Date | null;
  adminNote: string | null;
  receivedAt: Date | null;
  restockedAt: Date | null;
  refundAmount: Money | null;
  refundDelivery: Money | null;
  refundMethod: RefundMethod | null;
  refundReference: string | null;
  refundedAt: Date | null;
  createdAt: Date;
  shopId: string;
  order: { orderNo: string; contactName: string };
  shopOrder: { id: string; seq: number; shopName: string; deliveryCharge: Money; deliveredAt: Date | null };
  orderItem: { id: string; title: string; variantLabel: string | null; sku: string | null; unitPrice: Money; quantity: number };
}

export interface ReturnView {
  id: string;
  orderNo: string;
  shopOrderNo: string;
  shopOrderId: string;
  shopId: string;
  shopName: string;
  customerName: string;
  item: { id: string; title: string; variantLabel: string | null; sku: string | null; unitPrice: number; boughtQuantity: number };
  quantity: number;
  reason: ReturnReason;
  reasonLabel: string;
  details: string | null;
  photoCount: number;
  policyVersion: number | null;
  status: ReturnStatus;
  statusLabel: string;
  createdAt: string;
  statusChangedAt: string;
  shopDueAt: string;
  /** Still waiting for the shop after its 48 h. */
  shopOverdue: boolean;
  shopRespondedAt: string | null;
  shopNote: string | null;
  escalatedAt: string | null;
  escalationReason: "no_response" | "customer_dispute" | null;
  disputeNote: string | null;
  adminNote: string | null;
  receivedAt: string | null;
  restocked: boolean;
  refund: { amount: number; delivery: number; method: RefundMethod; methodLabel: string; reference: string; refundedAt: string } | null;
  /** The customer may still cancel (before the shop answers) or dispute a rejection. */
  canCancel: boolean;
  canDispute: boolean;
  /** Staff: suggested refund limit and the default "put back in stock" choice. */
  refundLimit: RefundLimit;
  restockByDefault: boolean;
}

const tk = (m: Money) => Number(m.toString());
const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toReturnView(r: ReturnRowLike, now: Date, deliveryAlreadyRefunded = false): ReturnView {
  let canDispute = false;
  try {
    assertCanDispute(r, now);
    canDispute = true;
  } catch {
    canDispute = false;
  }
  return {
    id: r.id,
    orderNo: r.order.orderNo,
    shopOrderNo: `${r.order.orderNo}-${r.shopOrder.seq}`,
    shopOrderId: r.shopOrder.id,
    shopId: r.shopId,
    shopName: r.shopOrder.shopName,
    customerName: r.order.contactName,
    item: {
      id: r.orderItem.id,
      title: r.orderItem.title,
      variantLabel: r.orderItem.variantLabel,
      sku: r.orderItem.sku,
      unitPrice: tk(r.orderItem.unitPrice),
      boughtQuantity: r.orderItem.quantity,
    },
    quantity: r.quantity,
    reason: r.reason,
    reasonLabel: REASON_LABELS[r.reason],
    details: r.details,
    photoCount: r.photoKeys.length,
    policyVersion: r.policyVersion,
    status: r.status,
    statusLabel: RETURN_STATUS_LABELS[r.status],
    createdAt: r.createdAt.toISOString(),
    statusChangedAt: r.statusChangedAt.toISOString(),
    shopDueAt: r.shopDueAt.toISOString(),
    shopOverdue: r.status === "requested" && r.shopDueAt.getTime() <= now.getTime(),
    shopRespondedAt: iso(r.shopRespondedAt),
    shopNote: r.shopNote,
    escalatedAt: iso(r.escalatedAt),
    escalationReason: r.escalationReason === "no_response" || r.escalationReason === "customer_dispute" ? r.escalationReason : null,
    disputeNote: r.disputeNote,
    adminNote: r.adminNote,
    receivedAt: iso(r.receivedAt),
    restocked: r.restockedAt !== null,
    refund:
      r.refundedAt && r.refundMethod && r.refundAmount !== null
        ? {
            amount: tk(r.refundAmount),
            delivery: tk(r.refundDelivery ?? 0),
            method: r.refundMethod,
            methodLabel: REFUND_METHOD_LABELS[r.refundMethod],
            reference: r.refundReference ?? "",
            refundedAt: r.refundedAt.toISOString(),
          }
        : null,
    canCancel: r.status === "requested",
    canDispute,
    refundLimit: refundLimit({ unitPrice: r.orderItem.unitPrice.toString(), quantity: r.quantity, reason: r.reason, deliveryCharge: r.shopOrder.deliveryCharge.toString(), deliveryAlreadyRefunded }),
    restockByDefault: defaultRestock(r.reason),
  };
}
