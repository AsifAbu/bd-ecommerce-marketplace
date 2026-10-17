/**
 * Search configuration (ADR-003). Meilisearch is used when MEILI_URL is set; otherwise, or while
 * Meilisearch is unreachable, the Postgres adapter answers (correct for small catalogs: dev,
 * tests, seed data).
 */
export interface SearchConfig {
  meiliUrl: string | null;
  meiliKey: string | null;
  indexName: string;
}

export function loadSearchConfig(env: Record<string, string | undefined> = process.env): SearchConfig {
  const url = env.MEILI_URL?.trim();
  return {
    meiliUrl: url ? url.replace(/\/+$/, "") : null,
    meiliKey: env.MEILI_MASTER_KEY?.trim() || env.MEILI_API_KEY?.trim() || null,
    indexName: env.MEILI_INDEX?.trim() || "products",
  };
}

let cached: SearchConfig | undefined;

export function getSearchConfig(): SearchConfig {
  cached ??= loadSearchConfig();
  return cached;
}

/** Results per page (US-041). */
export const PER_PAGE = 24;
/** Deepest page served; refine the search to go further. */
export const MAX_PAGE = 100;
/** Options shown per checkbox facet (selected options are always shown). */
export const MAX_FACET_OPTIONS = 30;
