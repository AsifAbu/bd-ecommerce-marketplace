import type { BadgeTone } from "./badge";

/**
 * One place that decides which badge tone a status gets, so a status looks the same on every page.
 * brand (jade): finished well. warning: waiting for someone. sale (vermilion): went wrong or overdue.
 * neutral: closed, cancelled, off or unknown. Pass the raw status key (`handed_over`, `in_progress`).
 */
const BY_STATUS: Record<string, BadgeTone> = {
  // good / done
  delivered: "brand",
  refunded: "brand",
  resolved: "brand",
  approved: "brand",
  active: "brand",
  live: "brand",
  verified: "brand",
  paid: "brand",
  accepted: "brand",
  received: "brand",
  // waiting
  placed: "warning",
  requested: "warning",
  pending: "warning",
  open: "warning",
  in_progress: "warning",
  confirmed: "warning",
  packed: "warning",
  handed_over: "warning",
  due_soon: "warning",
  // trouble
  refused: "sale",
  escalated: "sale",
  overdue: "sale",
  rejected: "sale",
  denied: "sale",
  suspended: "sale",
  hidden: "sale",
  expired: "sale",
  medicine_suspended: "sale",
  shop_not_approved: "warning",
  // closed / off
  cancelled: "neutral",
  returned: "neutral",
  closed: "neutral",
  inactive: "neutral",
  draft: "neutral",
  out_of_stock: "neutral",
};

export function statusTone(status: string): BadgeTone {
  return BY_STATUS[status] ?? "neutral";
}
