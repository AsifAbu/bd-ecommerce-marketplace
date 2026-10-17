import type { FieldDef } from "@/features/catalog";
import { normalizeText } from "./synonyms";
import type { SearchDocument } from "./types";

/**
 * Builds the search document of a product (pure). The caller passes a live product (see
 * liveProductWhere) with its variants, images, shop and category, plus the category's schema
 * fields so option values get their labels. Returns null when no variant is in stock: only live,
 * in-stock products are searchable.
 */

export interface ProductForIndex {
  id: string;
  title: string;
  bengaliName: string | null;
  description: string;
  attributes: unknown;
  createdAt: Date;
  shop: { id: string; slug: string; name: string };
  category: { id: string; slug: string; name: string; path: string };
  /** Category names from the root to the leaf ("Books", "Fiction"), searchable. */
  categoryNames?: string[];
  variants: { price: { toString(): string } | number | string; stock: number; options: unknown }[];
  /** Ordered: the first is the cover. */
  images: { id: string }[];
}

export type IndexField = Pick<FieldDef, "key" | "type" | "source" | "options">;

/** Guideline text fields that are worth finding by keyword (the others, like origin, are noise). */
const KEYWORD_GUIDELINE_FIELDS = new Set(["model"]);

const DESCRIPTION_CHARS = 1000;
/** Text values longer than this are searchable keywords but not filter values. */
const FILTER_TEXT_CHARS = 100;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** "/a/b/c/" to ["a", "b", "c"]. */
export function pathIds(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

export function buildSearchDocument(product: ProductForIndex, fields: IndexField[]): SearchDocument | null {
  const inStock = product.variants.filter((v) => v.stock > 0);
  if (inStock.length === 0) return null;
  const prices = inStock.map((v) => Number(v.price.toString()));

  const byKey = new Map(fields.map((f) => [f.key, f]));
  const attributes = isRecord(product.attributes) ? product.attributes : {};
  const attrs: SearchDocument["attrs"] = {};
  const keywords: string[] = [];
  const label = (field: IndexField | undefined, value: string) => field?.options.find((o) => o.value === value)?.label ?? value;

  const addValue = (key: string, value: unknown) => {
    const field = byKey.get(key);
    if (value === null || value === undefined || value === "" || !field) return;
    if (field.source === "guideline") {
      // Guideline fields are never filters; a few are useful keywords.
      if (KEYWORD_GUIDELINE_FIELDS.has(key) && typeof value === "string") keywords.push(value);
      return;
    }
    if (typeof value === "boolean") {
      // A variant axis yes/no is true when any in-stock variant has it.
      attrs[key] = attrs[key] === true || value;
      return;
    }
    if (typeof value === "number") {
      const list = (Array.isArray(attrs[key]) ? attrs[key] : (attrs[key] = [])) as number[];
      pushUnique(list, value);
      return;
    }
    if (typeof value === "string") {
      const type = field.type;
      if (type === "date") return;
      if (type === "text") keywords.push(value);
      if (type === "text" && value.length > FILTER_TEXT_CHARS) return;
      const list = (Array.isArray(attrs[key]) ? attrs[key] : (attrs[key] = [])) as string[];
      pushUnique(list, value);
      return;
    }
    if (Array.isArray(value)) for (const v of value) addValue(key, v);
  };

  for (const [key, value] of Object.entries(attributes)) addValue(key, value);
  for (const v of inStock) if (isRecord(v.options)) for (const [key, value] of Object.entries(v.options)) addValue(key, value);

  // Brand is an enum attribute in some categories and the guideline text field in others.
  const rawBrand = attributes.brand;
  const brand = typeof rawBrand === "string" && rawBrand ? label(byKey.get("brand"), rawBrand) : null;
  // Option labels are searchable too ("AM5", "DDR5", "Paperback").
  for (const [key, value] of Object.entries(attrs)) {
    const field = byKey.get(key);
    if (Array.isArray(value) && field && (field.type === "enum" || field.type === "multi_enum")) {
      for (const v of value as string[]) if (key !== "brand") keywords.push(label(field, v));
    }
  }

  return {
    id: product.id,
    title: product.title,
    bengaliName: product.bengaliName?.normalize("NFC") || null,
    description: product.description.slice(0, DESCRIPTION_CHARS),
    brand,
    keywords: [...new Set(keywords.filter((k) => k !== brand))].join(" · "),
    shopId: product.shop.id,
    shopSlug: product.shop.slug,
    shopName: product.shop.name,
    categoryId: product.category.id,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    categoryPath: pathIds(product.category.path),
    categoryNames: product.categoryNames ?? [product.category.name],
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    inStock: true,
    coverImageId: product.images[0]?.id ?? null,
    createdAt: product.createdAt.getTime(),
    rating: null,
    attrs,
  };
}

/** The normalised searchable text of a document, by weight (Postgres adapter relevance). */
export function searchableFields(doc: SearchDocument): { text: string; weight: number }[] {
  return [
    { text: normalizeText(doc.title), weight: 4 },
    { text: normalizeText(doc.bengaliName ?? ""), weight: 4 },
    { text: normalizeText(doc.brand ?? ""), weight: 3 },
    { text: normalizeText(doc.keywords), weight: 2 },
    { text: normalizeText(doc.categoryNames.join(" ")), weight: 2 },
    { text: normalizeText(doc.description), weight: 1 },
  ];
}
