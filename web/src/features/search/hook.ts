import { sendJob } from "@/lib/jobs/boss";
import { getSearchConfig } from "./config";

/**
 * The hook the products feature calls after a write (createProductService's onProductsChanged):
 * enqueues `search.reindex-product`. Only needed when Meilisearch is configured; the Postgres
 * adapter reads the tables directly. Never throws and never delays the request.
 */

export interface ChangeNotifierDeps {
  enabled: () => boolean;
  send: (productIds: string[]) => Promise<unknown>;
  warn?: (message: string) => void;
}

/** Most product ids per job (a CSV import can touch up to its row limit at once). */
export const MAX_IDS_PER_JOB = 500;

export function createChangeNotifier(deps: ChangeNotifierDeps) {
  return (productIds: string[]): void => {
    if (!deps.enabled() || productIds.length === 0) return;
    const ids = [...new Set(productIds)];
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_JOB) {
      deps.send(ids.slice(i, i + MAX_IDS_PER_JOB)).catch((err: unknown) => {
        (deps.warn ?? console.warn)(`[search] re-index not queued (the daily re-index will catch up): ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  };
}

export const notifyProductsChanged = createChangeNotifier({
  enabled: () => !!getSearchConfig().meiliUrl,
  send: (productIds) => sendJob("search.reindex-product", { productIds }),
});
