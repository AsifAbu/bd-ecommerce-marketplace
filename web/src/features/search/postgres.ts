import { searchDocuments } from "./memory";
import type { SearchDocument, SearchEngine } from "./types";

/**
 * Postgres adapter: used when MEILI_URL is unset or Meilisearch is down. It reads live, in-stock
 * products straight from the tables (no index to keep in sync), narrowed in SQL by category and
 * keywords (title, Bengali name, description or a category name on the product's path, each query
 * word through its Bengali/Banglish spellings), then filters, counts facets and sorts in memory. Correct for small catalogs (dev,
 * tests, seed data); past `candidateLimit` matches it only sees the newest ones, which is why
 * production runs Meilisearch.
 */

export interface CandidateScope {
  /** Materialised path of the category scope ("/root/child/"), or null for all categories. */
  categoryPath: string | null;
  /** Expanded query words: every list must match through one of its spellings. */
  terms: string[][];
  limit: number;
}

export interface PostgresEngineDeps {
  loadCandidates(scope: CandidateScope): Promise<SearchDocument[]>;
  candidateLimit?: number;
  warn?: (message: string) => void;
}

export const DEFAULT_CANDIDATE_LIMIT = 2000;

export function createPostgresEngine(deps: PostgresEngineDeps): SearchEngine {
  const limit = deps.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
  return {
    name: "postgres",
    async search(req) {
      const candidates = await deps.loadCandidates({ categoryPath: req.category?.path ?? null, terms: req.terms, limit });
      if (candidates.length >= limit) {
        (deps.warn ?? console.warn)(`[search] postgres adapter hit its ${limit}-product limit; results may be incomplete (set MEILI_URL)`);
      }
      return searchDocuments(candidates, req);
    },
  };
}
