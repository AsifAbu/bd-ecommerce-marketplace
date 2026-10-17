import { AppError } from "@/lib/errors";

/**
 * Complaint rules (US-072; Guidelines 2021: complaints recorded and resolved within 72 h, and the
 * customer informed). Pure: clock and facts are passed in.
 *
 * - due_at = created + 72 h. A ticket still open or in progress after that is overdue; the job
 *   flags it once and alerts the admin.
 * - The customer, the shop involved and the admin write in the thread while it is open or in
 *   progress. The first answer from the shop or the admin moves it to "in progress".
 * - Only the Platform Admin resolves or closes a ticket, always with a resolution note.
 */

export class ComplaintError extends AppError {
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(status, code, message, fields);
    this.name = "ComplaintError";
  }
}

export const RESOLUTION_HOURS = 72;

export const COMPLAINT_CATEGORIES = ["delivery", "product", "return_refund", "shop_conduct", "other"] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  delivery: "Delivery (late, missing, not delivered)",
  product: "Product (damaged, wrong, not as described)",
  return_refund: "Return or refund",
  shop_conduct: "The shop's conduct",
  other: "Something else",
};

export const COMPLAINT_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export type AuthorRole = "customer" | "shop" | "admin";

export const ACTIVE_COMPLAINT_STATUSES: readonly ComplaintStatus[] = ["open", "in_progress"];

export const complaintDueAt = (createdAt: Date) => new Date(createdAt.getTime() + RESOLUTION_HOURS * 3_600_000);

export const isActive = (status: ComplaintStatus) => ACTIVE_COMPLAINT_STATUSES.includes(status);

/** Past its 72 h and not resolved or closed. */
export const isOverdue = (t: { status: ComplaintStatus; dueAt: Date }, now: Date) => isActive(t.status) && t.dueAt.getTime() <= now.getTime();

/** Resolved (or closed) by its due time: the "resolved within 72 h" metric. */
export const closedOnTime = (t: { dueAt: Date; resolvedAt: Date | null }) => t.resolvedAt !== null && t.resolvedAt.getTime() <= t.dueAt.getTime();

/** Hours left until due (negative when overdue), rounded down. */
export const hoursLeft = (dueAt: Date, now: Date) => Math.floor((dueAt.getTime() - now.getTime()) / 3_600_000);

function text(v: unknown, field: string, min: number, max: number, label: string): string {
  const t = typeof v === "string" ? v.trim() : "";
  if (t.length < min) throw new ComplaintError(422, "VALIDATION", "Check the highlighted fields", { [field]: `${label} (at least ${min} characters)` });
  if (t.length > max) throw new ComplaintError(422, "VALIDATION", "Check the highlighted fields", { [field]: `Keep it under ${max} characters` });
  return t;
}

export interface OpenInput {
  subject: string;
  category: ComplaintCategory;
  message: string;
}

export function parseOpenInput(body: { subject?: unknown; category?: unknown; message?: unknown }): OpenInput {
  const subject = text(body.subject, "subject", 5, 120, "Write a short subject");
  if (!(COMPLAINT_CATEGORIES as readonly unknown[]).includes(body.category)) {
    throw new ComplaintError(422, "VALIDATION", "Check the highlighted fields", { category: "Choose what the problem is about" });
  }
  const message = text(body.message, "message", 10, 2000, "Describe the problem");
  return { subject, category: body.category as ComplaintCategory, message };
}

export const parseMessage = (v: unknown) => text(v, "text", 2, 2000, "Write a message");
export const parseResolution = (v: unknown) => text(v, "resolution", 5, 2000, "Write what was done");

/** A reply is allowed while the ticket is open or in progress. */
export function assertCanReply(status: ComplaintStatus): void {
  if (!isActive(status)) throw new ComplaintError(409, "COMPLAINT_CLOSED", "This complaint is closed. Open a new one if the problem is back.");
}

/** The status after a reply: the first answer from the shop or the admin starts the work. */
export const statusAfterReply = (status: ComplaintStatus, role: AuthorRole): ComplaintStatus =>
  status === "open" && role !== "customer" ? "in_progress" : status;

export type AdminAction = "start" | "resolve" | "close";

/** Admin status changes: start (open only), resolve or close (open or in progress). */
export function adminTransition(status: ComplaintStatus, action: AdminAction): ComplaintStatus {
  if (action === "start") {
    if (status !== "open") throw new ComplaintError(409, "COMPLAINT_STATE", "Only an open complaint can be started.");
    return "in_progress";
  }
  if (!isActive(status)) throw new ComplaintError(409, "COMPLAINT_STATE", "This complaint is already resolved or closed.");
  return action === "resolve" ? "resolved" : "closed";
}
