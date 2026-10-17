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
  // One SMS + one email invoice for a placed order (US-051); retried until both are sent.
  "orders.notify-placed": z.object({ orderId: z.string().min(1).max(64) }),
  // Returns (US-070, US-071): unanswered requests to the admin after 48 h; SMS/email per status change.
  "returns.escalate-overdue": z.object({}),
  "returns.notify": z.object({
    returnId: z.string().min(1).max(64),
    event: z.enum(["requested", "accepted", "rejected", "escalated", "approved", "denied", "received", "refunded"]),
  }),
  // Complaints (US-072): the 72 h timer flags late tickets once; the customer is told of each change.
  "complaints.flag-overdue": z.object({}),
  "complaints.notify": z.object({
    ticketId: z.string().min(1).max(64),
    event: z.enum(["opened", "reply", "in_progress", "resolved", "closed", "overdue"]),
    messageId: z.string().max(64).optional(),
  }),
} as const;

export type QueueName = keyof typeof queues;
export type JobData<Q extends QueueName> = z.infer<(typeof queues)[Q]>;
