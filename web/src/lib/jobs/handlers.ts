import type { Job } from "pg-boss";
import { purgeStaleGuestCarts } from "@/features/cart/purge";
import { refreshLiveCounts } from "@/features/products/live-counts";
import { prismaExpiryDeps, runLicenceExpiryCheck } from "@/features/shops/licence-expiry";
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
    console.info("[worker] shops.licence-expiry", result);
  },
  "products.refresh-counts": async () => {
    const result = await refreshLiveCounts(new Date());
    console.info("[worker] products.refresh-counts", result);
  },
  "cart.purge-guest-carts": async () => {
    const removed = await purgeStaleGuestCarts(new Date());
    console.info("[worker] cart.purge-guest-carts", { removed });
  },
};
