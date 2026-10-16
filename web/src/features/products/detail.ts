import { CatalogError, EXPIRY_FIELD, GUIDELINE_FIELDS, type CategorySchema, type FieldDef } from "@/features/catalog";
import { dhakaToday } from "@/features/shops";
import { deliveryBreakdown, type DeliveryBreakdown } from "@/lib/delivery";
import { variantLabel } from "./display";

/**
 * Product detail page (US-044): the view model of one live listing. `buildProductPage` is pure;
 * `createProductPageLoader` fetches through injected functions so the rules are unit-tested
 * without a database. Only live listings load (liveProductWhere: active, not deleted, not
 * expired, shop approved, medicine selling not suspended); anything else is "not found".
 */

export interface DetailRow {
  id: string;
  title: string;
  description: string;
  attributes: unknown;
  expiresOn: Date | null;
  category: { id: string; name: string; path: string };
  shop: { id: string; name: string; slug: string; tier: "basic" | "verified" };
  variants: { id: string; price: { toString(): string } | number; stock: number; options: unknown; position: number }[];
  images: { id: string }[];
}

export interface SpecRow {
  key: string;
  label: string;
  value: string;
}

export interface AxisView {
  key: string;
  name: string;
  /** Only the values some variant uses, in schema order. */
  options: { value: string; label: string }[];
}

export interface VariantView {
  id: string;
  options: Record<string, string>;
  price: number;
  stock: number;
  label: string;
}

export type ReturnEligibility = "eligible" | "change_of_mind" | "excluded";

export interface ProductPage {
  id: string;
  title: string;
  description: string;
  images: { id: string; alt: string }[];
  shop: { name: string; slug: string; verified: boolean; href: string };
  /** Root to leaf. */
  breadcrumb: { id: string; name: string }[];
  specs: SpecRow[];
  axes: AxisView[];
  variants: VariantView[];
  price: { min: number; max: number };
  inStock: boolean;
  returns: { value: ReturnEligibility | null; label: string; text: string };
  weightGrams: number | null;
  delivery: { insideDhaka: DeliveryBreakdown; outsideDhaka: DeliveryBreakdown };
  /** "2027-12-31" when the listing has an expiry date. */
  expiresOn: string | null;
}

export const RETURN_TEXT: Record<ReturnEligibility, { label: string; text: string }> = {
  eligible: {
    label: "Returnable",
    text: "You can return it within 7 days of delivery if it is damaged, defective, the wrong item, size or colour, incomplete or not as described.",
  },
  change_of_mind: {
    label: "Returnable, including change of mind",
    text: "You can return it within 7 days of delivery for any of the usual reasons, or if you change your mind (unworn, with tags).",
  },
  excluded: {
    label: "Not returnable",
    text: "This item can't be returned. If your order has a problem, you can raise a complaint.",
  },
};

/** Fields shown elsewhere on the page, not in the specs table. */
const NOT_IN_SPECS = new Set(["quantity_unit", "return_eligibility"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-12-31" to "31 Dec 2027" (no time zone shifts: the value is a calendar date). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

const formatNumber = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

/** One attribute value as text for the specs table, or null when it can't be shown. */
export function formatValue(field: FieldDef, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const optionLabel = (v: unknown) => field.options.find((o) => o.value === v)?.label ?? String(v);
  switch (field.type) {
    case "enum":
      return optionLabel(value);
    case "multi_enum":
      return Array.isArray(value) && value.length ? value.map(optionLabel).join(", ") : null;
    case "number":
      return typeof value === "number" ? `${formatNumber(value)}${field.unit ? ` ${field.unit}` : ""}` : String(value);
    case "boolean":
      return value === true ? "Yes" : value === false ? "No" : null;
    case "date":
      return typeof value === "string" ? formatDate(value) : null;
    case "text":
      return String(value);
  }
}

/** Specs in schema display order (attributes, then guideline fields), variant axes left out. */
export function buildSpecs(schema: CategorySchema, attributes: Record<string, unknown>): SpecRow[] {
  const unitField = schema.fields.find((f) => f.key === "quantity_unit");
  const rows: SpecRow[] = [];
  for (const field of schema.fields) {
    if (field.isVariantAxis || NOT_IN_SPECS.has(field.key)) continue;
    let value = formatValue(field, attributes[field.key]);
    if (value === null) continue;
    if (field.key === "quantity" && unitField) {
      const unit = formatValue(unitField, attributes.quantity_unit);
      if (unit) value = `${value} ${unit}`;
    }
    const label = field.key === "weight_g" ? "Weight" : field.name;
    rows.push({ key: field.key, label, value });
  }
  return rows;
}

/**
 * The schema to render specs with. If the leaf was archived after listing (getCategorySchema
 * then refuses it), the guideline fields are still shown.
 */
export function fallbackSchema(category: { id: string; name: string }, hasExpiry: boolean): CategorySchema {
  return {
    categoryId: category.id,
    name: category.name,
    isOther: false,
    requiresLicence: false,
    requiresExpiry: hasExpiry,
    fields: [...GUIDELINE_FIELDS, ...(hasExpiry ? [EXPIRY_FIELD] : [])],
  };
}

export function buildProductPage(
  row: DetailRow,
  schema: CategorySchema,
  trail: { id: string; name: string }[],
): ProductPage {
  const attributes = isRecord(row.attributes) ? row.attributes : {};
  const axisFields = schema.fields.filter((f) => f.isVariantAxis);

  const variants: VariantView[] = [...row.variants]
    .sort((a, b) => a.position - b.position)
    .map((v) => {
      const raw = isRecord(v.options) ? v.options : {};
      const options = Object.fromEntries(Object.entries(raw).map(([k, val]) => [k, Array.isArray(val) ? val.join("|") : String(val)]));
      return {
        id: v.id,
        options,
        price: Number(v.price.toString()),
        stock: v.stock,
        label: variantLabel(options, axisFields),
      };
    });

  const axes: AxisView[] = axisFields
    .map((f) => {
      const used = new Set(variants.map((v) => v.options[f.key]).filter((x) => x !== undefined));
      const known = f.options.filter((o) => used.has(o.value));
      // Values no longer in the schema (e.g. an option archived later) still need a button.
      const extra = [...used].filter((u) => !f.options.some((o) => o.value === u)).map((u) => ({ value: u, label: u }));
      return { key: f.key, name: f.name, options: [...known, ...extra] };
    })
    .filter((a) => a.options.length > 0);

  const prices = variants.map((v) => v.price);
  const weight = typeof attributes.weight_g === "number" && attributes.weight_g >= 0 ? attributes.weight_g : null;
  const returnValue = attributes.return_eligibility;
  const returns =
    typeof returnValue === "string" && returnValue in RETURN_TEXT
      ? { value: returnValue as ReturnEligibility, ...RETURN_TEXT[returnValue as ReturnEligibility] }
      : { value: null, label: "Ask the shop", text: "The shop has not set return conditions for this item." };

  // Breadcrumb in path order (root first); unknown ids are skipped.
  const names = new Map(trail.map((c) => [c.id, c]));
  const breadcrumb = row.category.path
    .split("/")
    .filter(Boolean)
    .flatMap((id) => (names.has(id) ? [names.get(id)!] : []));

  const images = row.images.map((img, i) => ({
    id: img.id,
    alt: row.images.length === 1 ? row.title : `${row.title}, image ${i + 1} of ${row.images.length}`,
  }));

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images,
    shop: {
      name: row.shop.name,
      slug: row.shop.slug,
      verified: row.shop.tier === "verified",
      href: `/s/${row.shop.slug}`,
    },
    breadcrumb: breadcrumb.length ? breadcrumb : [{ id: row.category.id, name: row.category.name }],
    specs: buildSpecs(schema, attributes),
    axes,
    variants,
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    inStock: variants.some((v) => v.stock > 0),
    returns,
    weightGrams: weight,
    delivery: {
      insideDhaka: deliveryBreakdown({ insideDhaka: true, weightGrams: weight ?? 0 }),
      outsideDhaka: deliveryBreakdown({ insideDhaka: false, weightGrams: weight ?? 0 }),
    },
    expiresOn: row.expiresOn ? row.expiresOn.toISOString().slice(0, 10) : null,
  };
}

export interface ProductPageDeps {
  /** A live product (liveProductWhere) with its shop, category, variants and images (cover first). */
  findLiveProduct: (productId: string, today: Date) => Promise<DetailRow | null>;
  findCategories: (ids: string[]) => Promise<{ id: string; name: string }[]>;
  getCategorySchema: (categoryId: string) => Promise<CategorySchema>;
  now: () => Date;
}

export function createProductPageLoader(deps: ProductPageDeps) {
  /** The page of a live product, or null (show 404). */
  return async function loadProductPage(productId: string): Promise<ProductPage | null> {
    if (!productId || productId.length > 64) return null;
    const row = await deps.findLiveProduct(productId, dhakaToday(deps.now()));
    if (!row || row.variants.length === 0) return null;
    const ids = row.category.path.split("/").filter(Boolean);
    const [schema, trail] = await Promise.all([
      deps.getCategorySchema(row.category.id).catch((err: unknown) => {
        if (err instanceof CatalogError) return fallbackSchema(row.category, row.expiresOn !== null);
        throw err;
      }),
      deps.findCategories(ids),
    ]);
    return buildProductPage(row, schema, trail);
  };
}
