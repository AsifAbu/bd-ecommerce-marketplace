import type { IndexingEngine, SearchDocument } from "./types";

/**
 * Keeps the Meilisearch index in step with Postgres (the source of truth):
 * - `search.reindex-product` (after product writes): upserts the products that are still
 *   searchable and removes the others (deleted, inactive, expired, out of stock...).
 * - `search.reindex-all` (daily, and after seeding): re-applies the index settings, upserts every
 *   searchable product, then removes documents the run did not touch. Catches changes that do not
 *   go through a product write (shop suspended, licence lapsed, expiry dates passing).
 * With no Meilisearch configured both are no-ops: the Postgres adapter reads the tables directly.
 */

export interface IndexerDeps {
  engine: IndexingEngine | null;
  loadDocuments(ids: string[]): Promise<SearchDocument[]>;
  allDocuments(): AsyncIterable<SearchDocument[]>;
  now?: () => number;
}

export type IndexResult = { skipped: true } | { skipped: false; indexed: number; removed?: number };

export function createIndexer(deps: IndexerDeps) {
  const now = deps.now ?? Date.now;

  async function reindexProducts(productIds: string[]): Promise<IndexResult> {
    if (!deps.engine) return { skipped: true };
    const ids = [...new Set(productIds)];
    const docs = await deps.loadDocuments(ids);
    const found = new Set(docs.map((d) => d.id));
    const gone = ids.filter((id) => !found.has(id));
    await deps.engine.upsert(docs);
    await deps.engine.remove(gone);
    return { skipped: false, indexed: docs.length, removed: gone.length };
  }

  async function reindexAll(): Promise<IndexResult> {
    if (!deps.engine) return { skipped: true };
    // Documents stamped before this moment and not re-sent are stale. A small margin covers
    // clock skew between this worker and the engine (the stamp is set here, not by the engine).
    const startedAt = now() - 1;
    await deps.engine.configure();
    let indexed = 0;
    for await (const batch of deps.allDocuments()) {
      await deps.engine.upsert(batch);
      indexed += batch.length;
    }
    await deps.engine.removeStale(startedAt);
    return { skipped: false, indexed };
  }

  return { reindexProducts, reindexAll };
}

export type Indexer = ReturnType<typeof createIndexer>;
