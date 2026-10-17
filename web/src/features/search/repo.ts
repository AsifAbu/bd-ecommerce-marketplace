import type { Prisma } from "@/generated/prisma/client";
import { getCategorySchema } from "@/features/catalog";
import { liveProductWhere } from "@/features/products";
import { prisma } from "@/lib/db";
import type { CategoryRow } from "./categories";
import { buildSearchDocument, pathIds, type IndexField, type ProductForIndex } from "./documents";
import type { CandidateScope } from "./postgres";
import type { CategoryInfo, FilterField } from "./service";
import type { SearchDocument } from "./types";

/**
 * Search data access. Public and read-only: everything here returns customer-safe data of live
 * listings only (liveProductWhere plus at least one variant in stock).
 */

/** Live (see products' liveProductWhere) and at least one variant in stock. */
export function searchableWhere(today: Date): Prisma.ProductWhereInput {
  return { AND: [liveProductWhere(today), { variants: { some: { stock: { gt: 0 } } } }] };
}

const productSelect = {
  id: true,
  title: true,
  bengaliName: true,
  description: true,
  attributes: true,
  createdAt: true,
  shop: { select: { id: true, slug: true, name: true } },
  category: { select: { id: true, slug: true, name: true, path: true } },
  variants: { select: { price: true, stock: true, options: true }, orderBy: { position: "asc" } },
  images: { select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.ProductSelect;

/** Schema fields per category, loaded once per call (archived or broken categories: none). */
function fieldCache() {
  const cache = new Map<string, Promise<IndexField[]>>();
  return (categoryId: string) => {
    let fields = cache.get(categoryId);
    if (!fields) {
      fields = getCategorySchema(categoryId).then(
        (s) => s.fields,
        () => [],
      );
      cache.set(categoryId, fields);
    }
    return fields;
  };
}

async function toDocuments(products: ProductForIndex[]): Promise<SearchDocument[]> {
  if (products.length === 0) return [];
  const fieldsOf = fieldCache();
  const names = new Map((await prisma.category.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const docs: SearchDocument[] = [];
  for (const p of products) {
    const categoryNames = pathIds(p.category.path).flatMap((id) => (names.has(id) ? [names.get(id)!] : []));
    const doc = buildSearchDocument({ ...p, categoryNames }, await fieldsOf(p.category.id));
    if (doc) docs.push(doc);
  }
  return docs;
}

/** Ids of categories whose name contains one of the words (a word can name a whole branch). */
async function categoriesNamed(words: string[]): Promise<string[]> {
  const rows = await prisma.category.findMany({
    where: { archivedAt: null, OR: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Postgres adapter: candidates in the category scope matching every query word. */
export async function loadCandidates(scope: CandidateScope, today: Date): Promise<SearchDocument[]> {
  const and: Prisma.ProductWhereInput[] = [searchableWhere(today)];
  if (scope.categoryPath) and.push({ category: { path: { startsWith: scope.categoryPath } } });
  for (const alternatives of scope.terms) {
    const branches = await categoriesNamed(alternatives);
    and.push({
      OR: [
        ...alternatives.flatMap((word) => [
          { title: { contains: word, mode: "insensitive" as const } },
          { bengaliName: { contains: word, mode: "insensitive" as const } },
          { description: { contains: word, mode: "insensitive" as const } },
        ]),
        ...branches.map((id) => ({ category: { path: { contains: `/${id}/` } } })),
      ],
    });
  }
  const products = await prisma.product.findMany({
    where: { AND: and },
    select: productSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: scope.limit,
  });
  return toDocuments(products);
}

/** Documents for these products; products no longer searchable are simply missing. */
export async function loadDocuments(ids: string[], today: Date): Promise<SearchDocument[]> {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({ where: { AND: [searchableWhere(today), { id: { in: ids } }] }, select: productSelect });
  return toDocuments(products);
}

/** Every searchable product, in batches (full re-index). */
export async function* allDocuments(today: Date, batchSize = 500): AsyncGenerator<SearchDocument[]> {
  let cursor: string | undefined;
  for (;;) {
    const products = await prisma.product.findMany({
      where: searchableWhere(today),
      select: productSelect,
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (products.length === 0) return;
    yield await toDocuments(products);
    cursor = products[products.length - 1].id;
    if (products.length < batchSize) return;
  }
}

/** Searchable products per (leaf) category id. */
export async function countSearchableByCategory(today: Date): Promise<Map<string, number>> {
  const rows = await prisma.product.groupBy({ by: ["categoryId"], where: searchableWhere(today), _count: { _all: true } });
  return new Map(rows.map((r) => [r.categoryId, r._count._all]));
}

export function listCategoryRows(): Promise<CategoryRow[]> {
  return prisma.category.findMany({
    select: { id: true, parentId: true, name: true, slug: true, path: true, isLeaf: true, isOther: true, archivedAt: true },
  });
}

export function findCategoryBySlug(slug: string): Promise<CategoryInfo | null> {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, path: true, isLeaf: true, archivedAt: true },
  });
}

export function categoriesByIds(ids: string[]) {
  return prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, name: true } });
}

export function shopsBySlugs(slugs: string[]) {
  return prisma.shop.findMany({ where: { slug: { in: slugs }, status: "approved" }, select: { slug: true, name: true } });
}

/** The filterable attributes of a leaf category (its filter panel, US-042). */
export async function filterFields(categoryId: string): Promise<FilterField[]> {
  const schema = await getCategorySchema(categoryId);
  return schema.fields
    .filter((f) => f.filterable && f.source === "attribute")
    .map((f) => ({ key: f.key, name: f.name, type: f.type, unit: f.unit, widget: f.filterWidget, displayOrder: f.displayOrder, options: f.options }));
}
