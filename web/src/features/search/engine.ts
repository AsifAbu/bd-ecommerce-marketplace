import { EngineUnavailableError } from "./meili";
import type { EngineRequest, EngineResult, SearchEngine } from "./types";

/**
 * Chooses the search engine per request: Meilisearch when configured and reachable, else
 * Postgres. After a Meilisearch failure it stays on Postgres for `retryAfterMs` before trying
 * Meilisearch again, so an outage costs one failed call per interval, not one per search.
 */

export interface EngineSelectorDeps {
  meili: SearchEngine | null;
  postgres: SearchEngine;
  now?: () => number;
  retryAfterMs?: number;
  warn?: (message: string) => void;
}

export interface SelectedResult {
  result: EngineResult;
  engine: SearchEngine["name"];
}

export function createEngineSelector(deps: EngineSelectorDeps) {
  const now = deps.now ?? Date.now;
  const retryAfter = deps.retryAfterMs ?? 30_000;
  const warn = deps.warn ?? ((m: string) => console.warn(m));
  let meiliDownUntil = 0;

  /** The engine the next search will try first. */
  function current(): SearchEngine {
    return deps.meili && now() >= meiliDownUntil ? deps.meili : deps.postgres;
  }

  async function search(req: EngineRequest): Promise<SelectedResult> {
    const engine = current();
    if (engine === deps.meili) {
      try {
        return { result: await engine.search(req), engine: engine.name };
      } catch (err) {
        if (!(err instanceof EngineUnavailableError)) throw err;
        meiliDownUntil = now() + retryAfter;
        warn(`[search] ${err.message}; using Postgres for ${Math.round(retryAfter / 1000)} s`);
      }
    }
    return { result: await deps.postgres.search(req), engine: deps.postgres.name };
  }

  return { search, current };
}

export type EngineSelector = ReturnType<typeof createEngineSelector>;
