import type { Job } from "pg-boss";
import { purgeStaleGuestCarts } from "@/features/cart/purge";
import { checkHandovers, notifyOverdue } from "@/features/orders/lifecycle/server";
import { notifyOrderPlaced } from "@/features/orders/server";
import { refreshLiveCounts } from "@/features/products/live-counts";
import { checkPayoutsDue } from "@/features/payouts/server";
import { flagOverdueComplaints, notifyComplaint } from "@/features/complaints/server";
import { escalateOverdueReturns, notifyReturn } from "@/features/returns/server";
import { refreshAllScores } from "@/features/metrics/server";
import { indexer } from "@/features/search/server";
import { hasStateFailures, prismaExpiryDeps, runLicenceExpiryCheck } from "@/features/shops/licence-expiry";
import { queues, type JobData, type QueueName } from "./queues";

type Handlers = { [Q in QueueName]: (jobs: Job<JobData<Q>>[]) => Promise<void> };

export const handlers: Handlers = {
  "example.log": async (jobs) => {
    for (const job of jobs) {
      const { message } = queues["example.log"].parse(job.data);
      console.info(`[worker] example.log ${job.id}: ${message}`);
    }
  },
  "shops.licence-expiry": async () => {
    const result = await runLicenceExpiryCheck(new Date(), prismaExpiryDeps);
    console.info("[worker] shops.licence-expiry", JSON.stringify(result));
    // A failed suspension or expiry fails the job so pg-boss retries it (done items are not picked again).
    // Failed emails are only logged: the state change they describe is already saved.
    if (hasStateFailures(result)) {
      throw new Error(`shops.licence-expiry: ${result.failures.length} step(s) failed, see the log`);
    }
  },
  // A shop whose score cannot be computed fails the job (pg-boss retries); the others are saved.
  "shops.refresh-scores": async () => {
    const result = await refreshAllScores();
    console.info("[worker] shops.refresh-scores", JSON.stringify(result));
    if (result.failures.length) throw new Error(`shops.refresh-scores: ${result.failures.length} shop(s) failed, see the log`);
  },
  "products.refresh-counts": async () => {
    const result = await refreshLiveCounts(new Date());
    console.info("[worker] products.refresh-counts", result);
  },
  "cart.purge-guest-carts": async () => {
    const removed = await purgeStaleGuestCarts(new Date());
    console.info("[worker] cart.purge-guest-carts", { removed });
  },
  "search.reindex-product": async (jobs) => {
    for (const job of jobs) {
      const { productIds } = queues["search.reindex-product"].parse(job.data);
      const result = await indexer.reindexProducts(productIds);
      console.info("[worker] search.reindex-product", result);
    }
  },
  "search.reindex-all": async () => {
    const result = await indexer.reindexAll();
    console.info("[worker] search.reindex-all", result);
  },
  // Throws when the SMS or email failed, so pg-boss retries; channels already sent are skipped.
  "orders.notify-placed": async (jobs) => {
    for (const job of jobs) {
      const { orderId } = queues["orders.notify-placed"].parse(job.data);
      const result = await notifyOrderPlaced(orderId);
      console.info("[worker] orders.notify-placed", orderId, result);
    }
  },
  // Failures (alert not queued) fail the job; the next run picks those shop orders up again.
  "orders.handover-check": async () => {
    const result = await checkHandovers(new Date());
    console.info("[worker] orders.handover-check", JSON.stringify(result));
    if (result.failures.length) throw new Error(`orders.handover-check: ${result.failures.length} alert(s) not queued`);
  },
  // Throws when a channel failed, so pg-boss retries.
  "orders.notify-overdue": async (jobs) => {
    for (const job of jobs) {
      const { shopOrderId } = queues["orders.notify-overdue"].parse(job.data);
      const result = await notifyOverdue(shopOrderId);
      console.info("[worker] orders.notify-overdue", shopOrderId, result);
    }
  },
  "payouts.due-check": async () => {
    const result = await checkPayoutsDue(new Date());
    console.info("[worker] payouts.due-check", result);
  },
  // US-071: requests the shop left unanswered for 48 h go to the admin (every 15 minutes).
  "returns.escalate-overdue": async () => {
    const result = await escalateOverdueReturns();
    console.info("[worker] returns.escalate-overdue", { escalated: result.escalated.length });
  },
  "returns.notify": async (jobs) => {
    for (const job of jobs) {
      const { returnId, event } = queues["returns.notify"].parse(job.data);
      console.info("[worker] returns.notify", returnId, event, await notifyReturn(returnId, event));
    }
  },
  // US-072: tickets past their 72 h are flagged once and the admin is alerted (every 15 minutes).
  "complaints.flag-overdue": async () => {
    const result = await flagOverdueComplaints();
    console.info("[worker] complaints.flag-overdue", { flagged: result.flagged.length });
  },
  "complaints.notify": async (jobs) => {
    for (const job of jobs) {
      const { ticketId, event, messageId } = queues["complaints.notify"].parse(job.data);
      console.info("[worker] complaints.notify", ticketId, event, await notifyComplaint(ticketId, event, messageId));
    }
  },
};
