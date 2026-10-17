import { describe, expect, it, vi } from "vitest";
import { createChangeNotifier } from "./hook";
import { createIndexer } from "./indexer";
import { doc } from "./test-fixtures";
import type { IndexingEngine } from "./types";

function fakeIndex() {
  return {
    name: "meilisearch" as const,
    search: vi.fn(),
    configure: vi.fn(async () => undefined),
    upsert: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    removeStale: vi.fn(async () => undefined),
  } satisfies IndexingEngine;
}

describe("search.reindex-product", () => {
  it("upserts products that are still searchable and removes the rest", async () => {
    const engine = fakeIndex();
    const a = doc({ id: "a" });
    const indexer = createIndexer({ engine, loadDocuments: async () => [a], allDocuments: async function* () {} });
    expect(await indexer.reindexProducts(["a", "gone", "a"])).toEqual({ skipped: false, indexed: 1, removed: 1 });
    expect(engine.upsert).toHaveBeenCalledWith([a]);
    expect(engine.remove).toHaveBeenCalledWith(["gone"]);
  });

  it("is a no-op without Meilisearch (the Postgres adapter reads the tables)", async () => {
    const loadDocuments = vi.fn();
    const indexer = createIndexer({ engine: null, loadDocuments, allDocuments: async function* () {} });
    expect(await indexer.reindexProducts(["a"])).toEqual({ skipped: true });
    expect(await indexer.reindexAll()).toEqual({ skipped: true });
    expect(loadDocuments).not.toHaveBeenCalled();
  });
});

describe("search.reindex-all", () => {
  it("configures the index, upserts every batch, then prunes documents not seen in this run", async () => {
    const engine = fakeIndex();
    const indexer = createIndexer({
      engine,
      loadDocuments: async () => [],
      allDocuments: async function* () {
        yield [doc(), doc()];
        yield [doc()];
      },
      now: () => 5000,
    });
    expect(await indexer.reindexAll()).toEqual({ skipped: false, indexed: 3 });
    expect(engine.configure).toHaveBeenCalledBefore(engine.upsert);
    expect(engine.upsert).toHaveBeenCalledTimes(2);
    expect(engine.removeStale).toHaveBeenCalledWith(4999);
  });
});

describe("product change hook", () => {
  it("enqueues re-index jobs only when Meilisearch is configured, in batches, without throwing", async () => {
    const send = vi.fn(async () => "job");
    createChangeNotifier({ enabled: () => false, send })(["a"]);
    expect(send).not.toHaveBeenCalled();

    const notify = createChangeNotifier({ enabled: () => true, send });
    notify([]);
    expect(send).not.toHaveBeenCalled();
    notify(Array.from({ length: 501 }, (_, i) => `p${i}`).concat("p0"));
    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0] as unknown as [string[]])[0]).toHaveLength(500);
    expect((send.mock.calls[1] as unknown as [string[]])[0]).toEqual(["p500"]);
  });

  it("a queue failure is logged, not thrown", async () => {
    const warn = vi.fn();
    const notify = createChangeNotifier({ enabled: () => true, send: async () => Promise.reject(new Error("db down")), warn });
    expect(() => notify(["a"])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("db down"));
  });
});
