import { z } from "zod";

/**
 * Job registry: queue name -> payload schema. Add a queue here, then a handler
 * in src/lib/jobs/handlers.ts. Name queues "<feature>.<action>".
 */
export const queues = {
  "example.log": z.object({ message: z.string().min(1) }),
  "shops.licence-expiry": z.object({}),
  "products.refresh-counts": z.object({}),
  "cart.purge-guest-carts": z.object({}),
  "search.reindex-product": z.object({ productIds: z.array(z.string().min(1)).min(1).max(500) }),
  "search.reindex-all": z.object({}),
} as const;

export type QueueName = keyof typeof queues;
export type JobData<Q extends QueueName> = z.infer<(typeof queues)[Q]>;
