import type { Job } from "pg-boss";
import { purgeStaleGuestCarts } from "@/features/cart/purge";
import { checkHandovers, notifyOverdue } from "@/features/orders/lifecycle/server";
import { notifyOrderPlaced } from "@/features/orders/server";
import { refreshLiveCounts } from "@/features/products/live-counts";
import { checkPayoutsDue } from "@/features/payouts/server";
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
};
