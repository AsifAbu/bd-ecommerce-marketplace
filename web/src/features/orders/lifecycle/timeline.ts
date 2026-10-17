import { STATUS_LABELS, type ShopOrderStatus } from "../config";
import type { ActorRole, LifecycleAction } from "./machine";

/** A shop order's timeline for the customer and seller pages (US-053). Pure. */

export interface LifecycleEventLike {
  action: string;
  toStatus: ShopOrderStatus | string;
  actorRole: string;
  note: string | null;
  at: Date;
}

export interface TimelineEntry {
  label: string;
  /** ISO time; null for a step still to come. */
  at: string | null;
  note: string | null;
  done: boolean;
}

const ACTION_DONE: Record<LifecycleAction, string> = {
  confirm: "Confirmed by the shop",
  pack: "Packed",
  hand_over: "Handed over to the courier",
  deliver: "Delivered",
  refuse: "Delivery refused",
  cancel: "Cancelled",
  mark_returned: "Returned to the shop",
};

const CANCELLED_BY: Partial<Record<ActorRole, string>> = {
  customer: "Cancelled by the customer",
  shop_owner: "Cancelled by the shop",
  shop_staff: "Cancelled by the shop",
  admin: "Cancelled by the Platform Admin",
};

const NEXT_STEPS: Partial<Record<ShopOrderStatus, string[]>> = {
  placed: ["Confirmed by the shop", "Packed", "Handed over to the courier", "Delivered"],
  confirmed: ["Packed", "Handed over to the courier", "Delivered"],
  packed: ["Handed over to the courier", "Delivered"],
  handed_over: ["Delivered"],
};

export function buildTimeline(shopOrder: { status: ShopOrderStatus; statusChangedAt: Date; placedAt: Date }, events: readonly LifecycleEventLike[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ label: "Order placed", at: shopOrder.placedAt.toISOString(), note: null, done: true }];
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const e of sorted) {
    const label =
      e.action === "cancel"
        ? (CANCELLED_BY[e.actorRole as ActorRole] ?? ACTION_DONE.cancel)
        : (ACTION_DONE[e.action as LifecycleAction] ?? STATUS_LABELS[e.toStatus as ShopOrderStatus] ?? e.toStatus);
    entries.push({ label, at: e.at.toISOString(), note: e.note, done: true });
  }
  // Rows changed before the lifecycle existed (no events): show the current status once.
  if (sorted.length === 0 && shopOrder.status !== "placed") {
    entries.push({ label: STATUS_LABELS[shopOrder.status] ?? shopOrder.status, at: shopOrder.statusChangedAt.toISOString(), note: null, done: true });
  }
  for (const label of NEXT_STEPS[shopOrder.status] ?? []) entries.push({ label, at: null, note: null, done: false });
  return entries;
}
