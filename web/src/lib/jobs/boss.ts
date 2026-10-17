import { PgBoss } from "pg-boss";
import { queues, type JobData, type QueueName } from "./queues";

/** pg-boss uses its own "pgboss" schema in the app database (no Redis, ADR-009). */
export function createBoss(connectionString = process.env.DATABASE_URL): PgBoss {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PgBoss({ connectionString, schema: "pgboss" });
}

export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of Object.keys(queues)) {
    await boss.createQueue(name);
  }
}

const globalForBoss = globalThis as unknown as { bossReady?: Promise<PgBoss> };

/** Lazily started sender for app code (one per process). */
function getSender(): Promise<PgBoss> {
  globalForBoss.bossReady ??= (async () => {
    const boss = createBoss();
    boss.on("error", (err) => console.error("[jobs]", err));
    await boss.start();
    await ensureQueues(boss);
    return boss;
  })();
  return globalForBoss.bossReady;
}

/** Retry settings a job may pass (pg-boss defaults: 2 retries, no delay). */
export interface JobRetryOptions {
  retryLimit?: number;
  /** Seconds before the first retry. */
  retryDelay?: number;
  /** Double the delay on each retry. */
  retryBackoff?: boolean;
}

/** Enqueue a job with a validated payload. Returns the job id. */
export async function sendJob<Q extends QueueName>(name: Q, data: JobData<Q>, options?: JobRetryOptions): Promise<string | null> {
  const payload = queues[name].parse(data);
  const boss = await getSender();
  return options ? boss.send(name, payload, options) : boss.send(name, payload);
}
