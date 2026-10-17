import { describe, expect, it, vi } from "vitest";
import { loadSearchConfig } from "./config";
import { createEngineSelector } from "./engine";
import { EngineUnavailableError } from "./meili";
import { createPostgresEngine } from "./postgres";
import { doc, request } from "./test-fixtures";
import type { EngineResult, SearchEngine } from "./types";

const empty: EngineResult = { hits: [], total: 0, facets: { categories: {}, shops: {}, price: null, rating: {}, attrs: {} } };

function fakeEngine(name: SearchEngine["name"], impl?: () => Promise<EngineResult>) {
  return { name, search: vi.fn(impl ?? (async () => empty)) } satisfies SearchEngine;
}

describe("adapter selection", () => {
  it("reads MEILI_URL: unset means Postgres only", () => {
    expect(loadSearchConfig({})).toEqual({ meiliUrl: null, meiliKey: null, indexName: "products" });
    expect(loadSearchConfig({ MEILI_URL: "http://localhost:7700/", MEILI_MASTER_KEY: "k", MEILI_INDEX: "p2" })).toEqual({
      meiliUrl: "http://localhost:7700",
      meiliKey: "k",
      indexName: "p2",
    });
    expect(loadSearchConfig({ MEILI_URL: "  " }).meiliUrl).toBeNull();
  });

  it("uses Postgres when Meilisearch is not configured", async () => {
    const postgres = fakeEngine("postgres");
    const selector = createEngineSelector({ meili: null, postgres });
    expect((await selector.search(request())).engine).toBe("postgres");
  });

  it("uses Meilisearch when configured and reachable", async () => {
    const meili = fakeEngine("meilisearch");
    const postgres = fakeEngine("postgres");
    const selector = createEngineSelector({ meili, postgres });
    expect((await selector.search(request())).engine).toBe("meilisearch");
    expect(postgres.search).not.toHaveBeenCalled();
  });

  it("falls back to Postgres when Meilisearch is unreachable, and retries it after the interval", async () => {
    let now = 0;
    const meili = fakeEngine("meilisearch", async () => {
      throw new EngineUnavailableError("down");
    });
    const postgres = fakeEngine("postgres");
    const warn = vi.fn();
    const selector = createEngineSelector({ meili, postgres, now: () => now, retryAfterMs: 1000, warn });
    expect((await selector.search(request())).engine).toBe("postgres");
    expect(warn).toHaveBeenCalledTimes(1);
    now = 500;
    await selector.search(request());
    expect(meili.search).toHaveBeenCalledTimes(1); // not retried yet
    now = 1000;
    expect(selector.current().name).toBe("meilisearch");
    await selector.search(request());
    expect(meili.search).toHaveBeenCalledTimes(2);
  });

  it("does not hide programming errors behind the fallback", async () => {
    const meili = fakeEngine("meilisearch", async () => {
      throw new TypeError("bug");
    });
    const selector = createEngineSelector({ meili, postgres: fakeEngine("postgres") });
    await expect(selector.search(request())).rejects.toThrow("bug");
  });
});

describe("Postgres adapter", () => {
  it("loads candidates for the category scope and expanded words, then searches them", async () => {
    const loadCandidates = vi.fn(async () => [doc({ id: "a", title: "Himu", categoryPath: ["books", "fiction"] })]);
    const engine = createPostgresEngine({ loadCandidates });
    const res = await engine.search(request({ terms: [["himu"]], category: { id: "books", path: "/books/" } }));
    expect(loadCandidates).toHaveBeenCalledWith({ categoryPath: "/books/", terms: [["himu"]], limit: 2000 });
    expect(res.hits.map((h) => h.id)).toEqual(["a"]);
  });

  it("warns when it reaches its candidate limit", async () => {
    const warn = vi.fn();
    const engine = createPostgresEngine({ loadCandidates: async () => [doc(), doc()], candidateLimit: 2, warn });
    await engine.search(request());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MEILI_URL"));
  });
});
