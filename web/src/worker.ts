/**
 * Background worker: `npm run worker`. Processes every queue in src/lib/jobs/queues.ts.
 * Pass --demo to enqueue one example job on start.
 */
import "dotenv/config";
import { getConfig } from "./lib/config";
import { assertSafeStartup } from "./lib/startup-guard";
import { createBoss, ensureQueues } from "./lib/jobs/boss";
import { handlers } from "./lib/jobs/handlers";
import type { QueueName } from "./lib/jobs/queues";

async function main() {
  assertSafeStartup(getConfig());

  const boss = createBoss();
  boss.on("error", (err) => console.error("[worker]", err));
  await boss.start();
  await ensureQueues(boss);

  for (const name of Object.keys(handlers) as QueueName[]) {
    await boss.work(name, handlers[name] as never);
  }
  console.info(`[worker] started (${getConfig().appMode} mode): ${Object.keys(handlers).join(", ")}`);

  // Daily jobs (cron in Bangladesh time).
  // US-053: the 48 h handover timer, every 15 minutes.
  await boss.schedule("orders.handover-check", "*/15 * * * *", {}, { tz: "Asia/Dhaka" });
  // US-082: collections near or past the 10-day payout deadline, every morning.
  await boss.schedule("payouts.due-check", "0 9 * * *", {}, { tz: "Asia/Dhaka" });
  await boss.schedule("shops.licence-expiry", "0 1 * * *", {}, { tz: "Asia/Dhaka" });
  // After the licence check (medicine suspensions) and just after midnight's expiry changes.
  // Seller scores (US-059) once the day's orders are in, before the search re-index.
  await boss.schedule("shops.refresh-scores", "0 2 * * *", {}, { tz: "Asia/Dhaka" });
  await boss.schedule("products.refresh-counts", "15 1 * * *", {}, { tz: "Asia/Dhaka" });
  // Guest carts untouched for 30 days (their cookie has expired too).
  await boss.schedule("cart.purge-guest-carts", "30 3 * * *", {}, { tz: "Asia/Dhaka" });
  // Full search re-index after the liveness changes above (no-op without Meilisearch).
  await boss.schedule("search.reindex-all", "30 1 * * *", {}, { tz: "Asia/Dhaka" });
  // Guideline timers: 48 h shop answer on returns, 72 h complaints (checked every 15 minutes).
  await boss.schedule("returns.escalate-overdue", "*/15 * * * *", {}, { tz: "Asia/Dhaka" });
  await boss.schedule("complaints.flag-overdue", "*/15 * * * *", {}, { tz: "Asia/Dhaka" });

  if (process.argv.includes("--demo")) {
    await boss.send("example.log", { message: "hello from the worker demo" });
  }

  const shutdown = async () => {
    console.info("[worker] stopping");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
