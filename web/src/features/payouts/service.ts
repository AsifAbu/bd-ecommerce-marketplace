import { z } from "zod";
import { fieldErrors } from "@/lib/actions";
import { PayoutError } from "./errors";
import { PAYOUT_METHODS, type DeliveryChargesTo, type PayoutConfig, type PayoutMethod } from "./ledger";
import { formatPaisa } from "./money";
import { summarizeUnbatched, toCollectionView, toPayoutView, type CollectionRowLike, type CollectionView, type PayoutRowLike, type PayoutView, type ShopDueSummary } from "./views";

/**
 * Payouts service (US-082): the shop's ledger view (owner only) and the admin's payout work.
 * The caller runs the guard first and passes the checked scope; the store is injected so the
 * rules are unit-tested without a database.
 */

export interface PayoutStore {
  listCollectionsForShop(shopId: string): Promise<CollectionRowLike[]>;
  listPayoutsForShop(shopId: string): Promise<PayoutRowLike[]>;
  listUnbatchedCollections(): Promise<CollectionRowLike[]>;
  listPayouts(filters: { status?: "pending" | "paid" | "cancelled" }): Promise<PayoutRowLike[]>;
  createPayoutBatch(shopId: string, actorId: string, deliveryChargesTo: DeliveryChargesTo): Promise<PayoutRowLike>;
  markPayoutPaid(payoutId: string, input: { method: PayoutMethod; reference: string }, actorId: string, now: Date): Promise<void>;
  cancelPayout(payoutId: string, reason: string, actorId: string, now: Date): Promise<void>;
  recordCollectionManually(shopOrderId: string, actorId: string, now: Date, payoutDays: number): Promise<{ id: string }>;
}

export interface PayoutServiceDeps {
  store: PayoutStore;
  config: PayoutConfig;
  now: () => Date;
}

const idSchema = z.string().trim().min(1, "Missing id").max(64);
const markPaidSchema = z.object({
  method: z.enum(PAYOUT_METHODS, { error: "Choose how the money was sent" }),
  reference: z.string().trim().min(3, "Enter the transaction or cheque reference (at least 3 characters)").max(100, "Use at most 100 characters"),
});
const cancelSchema = z.object({ reason: z.string().trim().min(3, "Enter a reason (at least 3 characters)").max(500, "Use at most 500 characters") });

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new PayoutError(422, "VALIDATION", "Check the highlighted fields", fieldErrors(r.error));
  return r.data;
}

const parseId = (value: unknown, field: string) => {
  const r = idSchema.safeParse(value);
  if (!r.success) throw new PayoutError(422, "VALIDATION", "Check the highlighted fields", { [field]: "Missing id" });
  return r.data;
};

export interface ShopLedger {
  collections: CollectionView[];
  payouts: PayoutView[];
  totals: { unpaidNet: number; dueSoon: number; overdue: number; paidNet: number };
  deliveryChargesTo: DeliveryChargesTo;
}

export function createPayoutService(deps: PayoutServiceDeps) {
  const { store, config } = deps;

  return {
    /** The shop's ledger: collections, due dates and payouts (call with the guard-checked shopId). */
    async shopLedger(shopId: string): Promise<ShopLedger> {
      const now = deps.now();
      const [collections, payouts] = await Promise.all([store.listCollectionsForShop(shopId), store.listPayoutsForShop(shopId)]);
      const cv = collections.map((c) => toCollectionView(c, config.deliveryChargesTo, now, config.dueSoonDays));
      const unpaid = cv.filter((c) => c.payable && !c.paidOutAt);
      return {
        collections: cv,
        payouts: payouts.map((p) => toPayoutView(p, now)),
        totals: {
          unpaidNet: unpaid.reduce((a, c) => a + c.net, 0),
          dueSoon: unpaid.filter((c) => c.dueState === "due_soon").length,
          overdue: unpaid.filter((c) => c.dueState === "overdue").length,
          paidNet: payouts.filter((p) => p.status === "paid").reduce((a, p) => a + toPayoutView(p, now).net, 0),
        },
        deliveryChargesTo: config.deliveryChargesTo,
      };
    },

    /** Admin overview: collections due per shop, pending payouts, recent paid ones. */
    async adminOverview(): Promise<{ due: ShopDueSummary[]; pending: PayoutView[]; recent: PayoutView[] }> {
      const now = deps.now();
      const [unbatched, pending, paid] = await Promise.all([
        store.listUnbatchedCollections(),
        store.listPayouts({ status: "pending" }),
        store.listPayouts({ status: "paid" }),
      ]);
      return {
        due: summarizeUnbatched(unbatched, config.deliveryChargesTo, now, config.dueSoonDays),
        pending: pending.map((p) => toPayoutView(p, now)),
        recent: paid.slice(0, 20).map((p) => toPayoutView(p, now)),
      };
    },

    async createBatch(adminId: string, body: { shopId?: unknown }): Promise<PayoutView> {
      const shopId = parseId(body.shopId, "shopId");
      return toPayoutView(await store.createPayoutBatch(shopId, adminId, config.deliveryChargesTo), deps.now());
    },

    async markPaid(adminId: string, payoutId: unknown, body: Record<string, unknown>): Promise<void> {
      const id = parseId(payoutId, "payoutId");
      const input = parse(markPaidSchema, body);
      await store.markPayoutPaid(id, input, adminId, deps.now());
    },

    async cancel(adminId: string, payoutId: unknown, body: Record<string, unknown>): Promise<void> {
      const id = parseId(payoutId, "payoutId");
      const { reason } = parse(cancelSchema, body);
      await store.cancelPayout(id, reason, adminId, deps.now());
    },

    async recordCollection(adminId: string, body: { shopOrderId?: unknown }): Promise<{ id: string }> {
      const shopOrderId = parseId(body.shopOrderId, "shopOrderId");
      return store.recordCollectionManually(shopOrderId, adminId, deps.now(), config.payoutDays);
    },
  };
}

export type PayoutService = ReturnType<typeof createPayoutService>;

// ---------- The daily payouts.due-check job ----------

export interface DueCheckDeps {
  /** Unpaid collections of delivered shop orders due before `until`. */
  unpaidDueBefore(until: Date): Promise<CollectionRowLike[]>;
  adminEmails(): Promise<string[]>;
  sendMail(mail: { to: string[]; subject: string; text: string }): Promise<void>;
  adminUrl(): string;
}

export interface DueCheckResult {
  overdue: number;
  dueSoon: number;
  shops: number;
  emailed: boolean;
}

/**
 * Flags collections whose 10-day payout deadline is near (within dueSoonDays) or past, and emails
 * the Platform Admins one summary. Throws when the email fails (the job is retried).
 */
export async function runPayoutDueCheck(now: Date, config: Pick<PayoutConfig, "deliveryChargesTo" | "dueSoonDays">, deps: DueCheckDeps): Promise<DueCheckResult> {
  const until = new Date(now.getTime() + config.dueSoonDays * 24 * 3_600_000);
  const rows = await deps.unpaidDueBefore(until);
  const views = rows.map((r) => toCollectionView(r, config.deliveryChargesTo, now, config.dueSoonDays));
  const overdue = views.filter((v) => v.dueState === "overdue");
  const dueSoon = views.filter((v) => v.dueState === "due_soon");
  const shops = new Set(views.map((v) => v.shopId)).size;
  const result: DueCheckResult = { overdue: overdue.length, dueSoon: dueSoon.length, shops, emailed: false };
  if (views.length === 0) return result;
  const to = await deps.adminEmails();
  if (to.length === 0) return result;
  const line = (v: CollectionView) => `- ${v.shopName}: ${v.shopOrderNo}, ${formatPaisa(v.net)} to pay, due ${v.payoutDueAt.slice(0, 10)}`;
  await deps.sendMail({
    to,
    subject: `Shop payouts: ${overdue.length} overdue, ${dueSoon.length} due within ${config.dueSoonDays} days`,
    text: [
      "Shops must be paid within 10 days of the cash collection (Guidelines 2021).",
      "",
      ...(overdue.length ? ["Overdue:", ...overdue.map(line), ""] : []),
      ...(dueSoon.length ? ["Due soon:", ...dueSoon.map(line), ""] : []),
      `Create and record payouts: ${deps.adminUrl()}`,
    ].join("\n"),
  });
  return { ...result, emailed: true };
}
