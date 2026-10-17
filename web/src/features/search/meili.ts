import { MAX_PAGE, PER_PAGE } from "./config";
import { meiliSynonyms } from "./synonyms";
import type { AttrFilter, EngineFacets, EngineRequest, EngineResult, IndexingEngine, SearchDocument } from "./types";

/**
 * Meilisearch adapter over its HTTP API (ADR-003), with `fetch` injected for tests. One index of
 * product documents. Facets are disjunctive like the Postgres adapter: one multi-search runs the
 * main query plus one query per active filter group (shops, price, each attribute) with that
 * group's own filter left out.
 */

export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

export interface MeiliOptions {
  url: string;
  apiKey: string | null;
  indexName: string;
  fetch?: typeof fetch;
  now?: () => number;
  /** Search request timeout in ms (indexing calls get 30 s). */
  timeoutMs?: number;
}

/** Index settings: searchable fields by importance, filters, sorting, synonyms (US-045). */
export function indexSettings() {
  return {
    searchableAttributes: ["title", "bengaliName", "brand", "keywords", "categoryNames", "description"],
    filterableAttributes: ["inStock", "categoryId", "categoryPath", "shopId", "shopSlug", "priceMin", "priceMax", "createdAt", "indexedAt", "attrs"],
    sortableAttributes: ["priceMin", "createdAt"],
    synonyms: meiliSynonyms(),
    faceting: { maxValuesPerFacet: 100 },
    pagination: { maxTotalHits: MAX_PAGE * PER_PAGE },
  };
}

/** A string literal in a Meilisearch filter. */
export function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function attrFilter(f: AttrFilter): string[] {
  const field = `attrs.${f.key}`;
  switch (f.kind) {
    case "toggle":
      return [`${field} = true`];
    case "values":
      return [`${field} IN [${f.values.map(quote).join(", ")}]`];
    case "range":
      if (f.min !== null && f.max !== null) return [`${field} ${f.min} TO ${f.max}`];
      if (f.min !== null) return [`${field} >= ${f.min}`];
      if (f.max !== null) return [`${field} <= ${f.max}`];
      return [];
  }
}

type Except = { shops?: boolean; price?: boolean; attr?: string };

/** The filter expressions (AND-ed) of a request, optionally leaving one filter group out. */
export function buildFilters(req: EngineRequest, except: Except = {}): string[] {
  const out = ["inStock = true"];
  if (req.category) out.push(`categoryPath = ${quote(req.category.id)}`);
  if (!except.shops && req.shops.length > 0) out.push(`shopSlug IN [${req.shops.map(quote).join(", ")}]`);
  if (!except.price && req.price) {
    if (req.price.min !== null) out.push(`priceMax >= ${req.price.min}`);
    if (req.price.max !== null) out.push(`priceMin <= ${req.price.max}`);
  }
  for (const f of req.attrs) if (f.key !== except.attr) out.push(...attrFilter(f));
  return out;
}

export function buildSort(req: EngineRequest): string[] | undefined {
  switch (req.sort) {
    case "price_asc":
      return ["priceMin:asc", "createdAt:desc"];
    case "price_desc":
      return ["priceMin:desc", "createdAt:desc"];
    case "newest":
      return ["createdAt:desc"];
    case "relevance":
      return req.q.trim() ? undefined : ["createdAt:desc"];
  }
}

interface MeiliQuery {
  indexUid: string;
  q: string;
  filter: string[];
  facets: string[];
  page?: number;
  hitsPerPage?: number;
  limit?: number;
  sort?: string[];
}

interface MeiliResponse {
  hits?: (SearchDocument & { indexedAt?: number })[];
  totalHits?: number;
  facetDistribution?: Record<string, Record<string, number>>;
  facetStats?: Record<string, { min: number; max: number }>;
}

/** What each query of the multi-search is for. */
type Purpose = { kind: "main" } | { kind: "shops" } | { kind: "price" } | { kind: "attr"; key: string };

/** The multi-search plan for a request: the main query, then one per active filter group. */
export function buildQueries(req: EngineRequest, indexUid: string): { purpose: Purpose; query: MeiliQuery }[] {
  const facetName = (key: string) => `attrs.${key}`;
  const filtered = new Set(req.attrs.map((f) => f.key));
  const mainFacets = ["categoryId"];
  if (req.shops.length === 0) mainFacets.push("shopSlug");
  if (!req.price) mainFacets.push("priceMin", "priceMax");
  for (const f of req.facets) if (!filtered.has(f.key)) mainFacets.push(facetName(f.key));

  const base = { indexUid, q: req.q };
  const facetOnly = (filter: string[], facets: string[]): MeiliQuery => ({ ...base, filter, facets, limit: 0 });
  const plan: { purpose: Purpose; query: MeiliQuery }[] = [
    {
      purpose: { kind: "main" },
      query: { ...base, filter: buildFilters(req), facets: mainFacets, page: req.page, hitsPerPage: req.perPage, sort: buildSort(req) },
    },
  ];
  if (req.shops.length > 0) plan.push({ purpose: { kind: "shops" }, query: facetOnly(buildFilters(req, { shops: true }), ["shopSlug"]) });
  if (req.price) plan.push({ purpose: { kind: "price" }, query: facetOnly(buildFilters(req, { price: true }), ["priceMin", "priceMax"]) });
  for (const f of req.facets) {
    if (filtered.has(f.key)) {
      plan.push({ purpose: { kind: "attr", key: f.key }, query: facetOnly(buildFilters(req, { attr: f.key }), [facetName(f.key)]) });
    }
  }
  for (const { query } of plan) if (!query.sort) delete query.sort;
  return plan;
}

/** Turns the multi-search responses back into engine facets and hits. */
export function readResults(req: EngineRequest, plan: { purpose: Purpose }[], responses: MeiliResponse[]): EngineResult {
  const facets: EngineFacets = { categories: {}, shops: {}, price: null, attrs: {} };
  let hits: SearchDocument[] = [];
  let total = 0;
  const priceOf = (r: MeiliResponse) => {
    const lo = r.facetStats?.priceMin;
    const hi = r.facetStats?.priceMax;
    return lo && hi ? { min: lo.min, max: hi.max } : null;
  };
  const attrOf = (r: MeiliResponse, key: string, kind: EngineRequest["facets"][number]["kind"]) => {
    const name = `attrs.${key}`;
    if (kind === "values") return { values: { ...(r.facetDistribution?.[name] ?? {}) } };
    if (kind === "toggle") return { trueCount: r.facetDistribution?.[name]?.true ?? 0 };
    const stats = r.facetStats?.[name];
    return { range: stats ? { min: stats.min, max: stats.max } : null };
  };
  const filtered = new Set(req.attrs.map((f) => f.key));

  plan.forEach(({ purpose }, i) => {
    const r = responses[i] ?? {};
    switch (purpose.kind) {
      case "main":
        hits = (r.hits ?? []).map((hit) => {
          const doc = { ...hit };
          delete doc.indexedAt;
          return doc as SearchDocument;
        });
        total = r.totalHits ?? 0;
        facets.categories = { ...(r.facetDistribution?.categoryId ?? {}) };
        if (req.shops.length === 0) facets.shops = { ...(r.facetDistribution?.shopSlug ?? {}) };
        if (!req.price) facets.price = priceOf(r);
        for (const f of req.facets) if (!filtered.has(f.key)) facets.attrs[f.key] = attrOf(r, f.key, f.kind);
        break;
      case "shops":
        facets.shops = { ...(r.facetDistribution?.shopSlug ?? {}) };
        break;
      case "price":
        facets.price = priceOf(r);
        break;
      case "attr": {
        const facet = req.facets.find((f) => f.key === purpose.key)!;
        facets.attrs[purpose.key] = attrOf(r, purpose.key, facet.kind);
        break;
      }
    }
  });
  return { hits, total, facets };
}

export function createMeiliEngine(options: MeiliOptions): IndexingEngine {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const index = options.indexName;

  async function call<T>(method: string, path: string, body?: unknown, timeoutMs = options.timeoutMs ?? 2000): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${options.url}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new EngineUnavailableError(`Meilisearch unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new EngineUnavailableError(`Meilisearch ${method} ${path} failed: ${res.status} ${(detail as { code?: string }).code ?? ""}`.trim());
    }
    return (await res.json().catch(() => ({}))) as T;
  }

  const slow = 30_000;

  return {
    name: "meilisearch",

    async search(req) {
      const plan = buildQueries(req, index);
      const { results } = await call<{ results: MeiliResponse[] }>("POST", "/multi-search", { queries: plan.map((p) => p.query) });
      return readResults(req, plan, results ?? []);
    },

    async configure() {
      try {
        await call("POST", "/indexes", { uid: index, primaryKey: "id" }, slow);
      } catch (err) {
        // 409 index_already_exists on some versions; anything else surfaces on the next call.
        if (!(err instanceof EngineUnavailableError) || !/409/.test(err.message)) throw err;
      }
      await call("PATCH", `/indexes/${index}/settings`, indexSettings(), slow);
    },

    async upsert(docs) {
      if (docs.length === 0) return;
      const indexedAt = now();
      await call("PUT", `/indexes/${index}/documents?primaryKey=id`, docs.map((d) => ({ ...d, indexedAt })), slow);
    },

    async remove(ids) {
      if (ids.length === 0) return;
      await call("POST", `/indexes/${index}/documents/delete-batch`, ids, slow);
    },

    async removeStale(before) {
      await call("POST", `/indexes/${index}/documents/delete`, { filter: `indexedAt < ${before}` }, slow);
    },
  };
}
