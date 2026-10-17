import { dhakaToday } from "@/features/shops";
import { buildVisibleTree, findVisible, type VisibleCategory } from "./categories";
import { getSearchConfig } from "./config";
import { createEngineSelector } from "./engine";
import { createIndexer } from "./indexer";
import { createMeiliEngine } from "./meili";
import { createPostgresEngine } from "./postgres";
import * as repo from "./repo";
import { createSearchService } from "./service";
import type { IndexingEngine } from "./types";

/** The search feature wired to the real database and (when MEILI_URL is set) Meilisearch. */

const today = () => dhakaToday(new Date());

function meiliEngine(): IndexingEngine | null {
  const config = getSearchConfig();
  return config.meiliUrl ? createMeiliEngine({ url: config.meiliUrl, apiKey: config.meiliKey, indexName: config.indexName }) : null;
}

/** One selector per module instance, so a Meilisearch outage is remembered across requests. */
export const engineSelector = createEngineSelector({
  meili: meiliEngine(),
  postgres: createPostgresEngine({ loadCandidates: (scope) => repo.loadCandidates(scope, today()) }),
});

export const searchService = createSearchService({
  findCategory: repo.findCategoryBySlug,
  getFilterFields: repo.filterFields,
  categoriesByIds: repo.categoriesByIds,
  shopsBySlugs: repo.shopsBySlugs,
  engine: engineSelector,
});

export const indexer = createIndexer({
  engine: meiliEngine(),
  loadDocuments: (ids) => repo.loadDocuments(ids, today()),
  allDocuments: () => repo.allDocuments(today()),
});

/** US-040: the category tree shoppers see (only categories with live, in-stock products). */
export async function getVisibleCategoryTree(): Promise<VisibleCategory[]> {
  const [rows, counts] = await Promise.all([repo.listCategoryRows(), repo.countSearchableByCategory(today())]);
  return buildVisibleTree(rows, counts);
}

/** A visible category by slug with its breadcrumb trail, or null (unknown, archived or empty). */
export async function getVisibleCategory(slug: string) {
  return findVisible(await getVisibleCategoryTree(), slug);
}
