import type { ShopOrderStatus } from "../config";
import { PRE_HANDOVER_STATUSES } from "./machine";

/**
 * The 48 h handover timer (US-053, Guidelines 2021: hand over within 48 h, with overdue alerts),
 * the countdown shown to sellers, and the handover-rate metric (plan metric: ≥ 95% of shop
 * orders handed over within 48 h) used later by the seller score (US-059) and reports (US-083).
 */

const isPreHandover = (status: string) => (PRE_HANDOVER_STATUSES as readonly string[]).includes(status);

/** True while the shop order still waits for handover and its deadline has passed. */
export function isOverdue(status: string, handoverDueAt: Date, now: Date): boolean {
  return isPreHandover(status) && now.getTime() > handoverDueAt.getTime();
}

export interface Countdown {
  /** Null when the timer no longer runs (handed over, cancelled…). */
  state: "running" | "due_soon" | "overdue" | null;
  /** Milliseconds left (negative when overdue). */
  msLeft: number;
  /** "1 d 3 h left", "45 min left", "Overdue by 2 h 5 min". */
  label: string | null;
}

/** Warn when less than this is left. */
export const DUE_SOON_MS = 6 * 3_600_000;

function duration(ms: number): string {
  const totalMin = Math.max(1, Math.floor(Math.abs(ms) / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

export function handoverCountdown(status: string, handoverDueAt: Date, now: Date): Countdown {
  const msLeft = handoverDueAt.getTime() - now.getTime();
  if (!isPreHandover(status)) return { state: null, msLeft, label: null };
  if (msLeft < 0) return { state: "overdue", msLeft, label: `Overdue by ${duration(msLeft)}` };
  return { state: msLeft <= DUE_SOON_MS ? "due_soon" : "running", msLeft, label: `${duration(msLeft)} left to hand over` };
}

// ---------- Handover-rate metric ----------

export interface HandoverFacts {
  status: ShopOrderStatus | string;
  handoverDueAt: Date;
  handedOverAt: Date | null;
  cancelledAt: Date | null;
}

export interface HandoverRate {
  /** Shop orders whose handover is decided (handed over, or past the deadline). */
  eligible: number;
  onTime: number;
  late: number;
  /** Not yet decided: still before the deadline. Not counted. */
  pending: number;
  /** Cancelled before the deadline (allowed, not a handover failure). Not counted. */
  excluded: number;
  /** onTime / eligible (0..1), null when nothing is eligible. */
  rate: number | null;
}

/**
 * Share of shop orders handed over within 48 h. On time: handed over at or before the deadline.
 * Late: handed over after it, still waiting after it, or cancelled after it. Orders cancelled
 * before the deadline and orders still inside their 48 h are left out. Shop orders past handover
 * with no handedOverAt (rows from before the lifecycle existed) are left out as unknown.
 */
export function computeHandoverRate(rows: readonly HandoverFacts[], now: Date): HandoverRate {
  const r = { eligible: 0, onTime: 0, late: 0, pending: 0, excluded: 0 };
  for (const row of rows) {
    const due = row.handoverDueAt.getTime();
    if (row.handedOverAt) {
      r.eligible++;
      if (row.handedOverAt.getTime() <= due) r.onTime++;
      else r.late++;
    } else if (row.status === "cancelled") {
      if (row.cancelledAt && row.cancelledAt.getTime() > due) {
        r.eligible++;
        r.late++;
      } else r.excluded++;
    } else if (isPreHandover(row.status)) {
      if (now.getTime() > due) {
        r.eligible++;
        r.late++;
      } else r.pending++;
    } else {
      r.excluded++; // past handover but no recorded time (older rows)
    }
  }
  return { ...r, rate: r.eligible ? r.onTime / r.eligible : null };
}

/** Plan target: 95% or more handed over within 48 h. */
export const HANDOVER_RATE_TARGET = 0.95;

// ---------- The orders.handover-check job ----------

export interface HandoverCheckDeps {
  /** Pre-handover shop orders past their deadline whose alert has not gone out (oldest first). */
  findNewlyOverdue(now: Date, limit: number): Promise<{ id: string }[]>;
  /** Queue the alert job (shop owner/staff by email + SMS, admins by email). */
  enqueueAlert(shopOrderId: string): Promise<unknown>;
  /** Set overdueNotifiedAt only if still null and still pre-handover; false when someone else did. */
  markNotified(shopOrderId: string, now: Date): Promise<boolean>;
}

export interface HandoverCheckResult {
  overdue: number;
  alerted: number;
  failures: { shopOrderId: string; error: string }[];
}

/**
 * Marks newly overdue shop orders once and queues their alerts. The alert is queued before the
 * mark, so a crash in between can at worst send a second alert, never lose one. One failure does
 * not stop the rest; failures are reported (the next run picks them up again).
 */
export async function runHandoverCheck(now: Date, deps: HandoverCheckDeps, limit = 500): Promise<HandoverCheckResult> {
  const rows = await deps.findNewlyOverdue(now, limit);
  const result: HandoverCheckResult = { overdue: rows.length, alerted: 0, failures: [] };
  for (const { id } of rows) {
    try {
      await deps.enqueueAlert(id);
      if (await deps.markNotified(id, now)) result.alerted++;
    } catch (err) {
      result.failures.push({ shopOrderId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

// ---------- The orders.notify-overdue job ----------

export interface OverdueAlertFacts {
  id: string;
  shopOrderNo: string;
  shopId: string;
  shopName: string;
  status: string;
  handoverDueAt: Date;
  /** Shop owner and staff. */
  members: { email: string | null; phone: string | null }[];
  adminEmails: string[];
}

export interface OverdueAlertDeps {
  load(shopOrderId: string): Promise<OverdueAlertFacts | null>;
  sendMail(mail: { to: string[]; subject: string; text: string }): Promise<void>;
  sendSms(phone: string, text: string): Promise<void>;
  sellerUrl(shopId: string, shopOrderId: string): string;
  adminUrl(): string;
  formatTime(d: Date): string;
}

/**
 * Sends the overdue alert for one shop order: an email to the shop's owner and staff, an SMS to
 * each of them with a mobile, and an email to the Platform Admins. Skipped when the order was
 * handed over or cancelled meanwhile. Throws when a channel failed, so the job is retried.
 */
export async function sendOverdueAlert(shopOrderId: string, deps: OverdueAlertDeps): Promise<{ sent: string[]; skipped?: string }> {
  const so = await deps.load(shopOrderId);
  if (!so) return { sent: [], skipped: "not found" };
  if (!isPreHandover(so.status)) return { sent: [], skipped: `already ${so.status}` };
  const due = deps.formatTime(so.handoverDueAt);
  const link = deps.sellerUrl(so.shopId, so.id);
  const sent: string[] = [];
  const errors: string[] = [];
  const attempt = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      sent.push(name);
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const memberEmails = [...new Set(so.members.map((m) => m.email).filter((e): e is string => !!e))];
  if (memberEmails.length) {
    await attempt("shop email", () =>
      deps.sendMail({
        to: memberEmails,
        subject: `Overdue: hand over order ${so.shopOrderNo} now`,
        text: [
          `Shop order ${so.shopOrderNo} (${so.shopName}) had to be handed over to the courier by ${due}.`,
          "The Bangladesh rules require handover within 48 hours of the order. Please hand it over now, or cancel it with a reason if you can't fulfil it.",
          "",
          `Open the order: ${link}`,
        ].join("\n"),
      }),
    );
  }
  for (const phone of new Set(so.members.map((m) => m.phone).filter((p): p is string => !!p))) {
    await attempt(`sms ${phone}`, () => deps.sendSms(phone, `Overdue: order ${so.shopOrderNo} had to be handed over by ${due}. Hand it over now: ${link}`));
  }
  if (so.adminEmails.length) {
    await attempt("admin email", () =>
      deps.sendMail({
        to: so.adminEmails,
        subject: `Handover overdue: ${so.shopOrderNo} (${so.shopName})`,
        text: `Shop order ${so.shopOrderNo} of ${so.shopName} is still ${so.status} after its 48 h handover deadline (${due}).\n\nOverdue orders: ${deps.adminUrl()}`,
      }),
    );
  }
  if (errors.length) throw new Error(`overdue alert for ${so.shopOrderNo} failed: ${errors.join("; ")}`);
  return { sent };
}
