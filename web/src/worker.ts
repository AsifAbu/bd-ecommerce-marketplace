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
