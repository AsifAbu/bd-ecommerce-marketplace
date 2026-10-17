import type { z } from "zod";
import { buildListingZod, buildVariantZod, type CategorySchema, type FieldDef } from "@/features/catalog";
import { validationError } from "./errors";

/**
 * Server-side validation of a listing (US-030, US-031). Product attributes are checked with the
 * category's buildListingZod (strict: unknown keys are rejected), each variant's options with
 * buildVariantZod. Pure: the caller passes the category schema and Bangladesh "today".
 */

export const TITLE_MIN = 3;
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const MAX_VARIANTS = 100;
export const MAX_STOCK = 1_000_000;
export const MAX_PRICE = 10_000_000; // Tk; fits Decimal(12, 2)
export const SKU_MAX = 64;

export interface VariantInput {
  /** Existing variant id (edit only). */
  id?: string;
  sku: string | null;
  /** Tk with exactly 2 decimals, e.g. "1250.00" (stored as Decimal). */
  price: string;
  stock: number;
  options: Record<string, unknown>;
  optionKey: string;
  position: number;
}

export interface ProductInput {
  title: string;
  description: string;
  attributes: Record<string, unknown>;
  variants: VariantInput[];
  /** attributes.expiry_date as a UTC-midnight date, or null. */
  expiresOn: Date | null;
}

/** The form's two parts, in schema display order: product fields and per-variant axis fields. */
export function formFields(schema: CategorySchema): { productFields: FieldDef[]; variantFields: FieldDef[] } {
  return {
    productFields: schema.fields.filter((f) => !f.isVariantAxis),
    variantFields: schema.fields.filter((f) => f.isVariantAxis),
  };
}

/** Canonical, order-independent key of a variant's options: "colour=black;size=m" ("" for none). */
export function optionKeyOf(options: Record<string, unknown>): string {
  return Object.keys(options)
    .sort()
    .map((k) => {
      const v = options[k];
      return `${k}=${Array.isArray(v) ? [...v].sort().join("|") : String(v)}`;
    })
    .join(";");
}

/** "2027-01-31" to a UTC-midnight Date (how @db.Date values are read back), or null. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Drops empty values ("" / null / []) so an optional field left blank counts as not given. */
function withoutEmpty(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, v]) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

function issueMessage(field: FieldDef, issue: z.core.$ZodIssue): string {
  switch (field.type) {
    case "number":
      return issue.code === "too_small" ? `${field.name} can't be negative` : `${field.name} must be a number`;
    case "boolean":
      return `Choose yes or no for ${field.name}`;
    case "date":
      return `${field.name} must be a date (YYYY-MM-DD)`;
    case "text":
      return issue.code === "too_big" ? `${field.name} is too long (2000 characters max)` : `${field.name} is required`;
    case "enum":
      return issue.code === "custom" ? issue.message : `Choose a ${field.name} option`;
    case "multi_enum":
      if (issue.code === "custom") return issue.message;
      return issue.code === "too_small" ? `Choose at least one ${field.name}` : `Choose ${field.name} options from the list`;
  }
}

/**
 * Checks values against a strict object schema built from `fields`. Unknown keys, missing
 * required fields and invalid values become field errors under `prefix` (e.g. "attributes.").
 */
function checkValues(
  fields: FieldDef[],
  zodSchema: z.ZodType,
  raw: Record<string, unknown>,
  prefix: string,
  unknownMessage: (key: string) => string,
  errors: Record<string, string>,
): { values: Record<string, unknown>; unknown: string[] } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const cleaned = withoutEmpty(raw);
  const unknown = Object.keys(cleaned).filter((k) => !byKey.has(k));
  for (const key of unknown) errors[`${prefix}${key}`] = unknownMessage(key);
  for (const f of fields) {
    if (f.required && !(f.key in cleaned)) errors[`${prefix}${f.key}`] = `${f.name} is required`;
  }
  const known = Object.fromEntries(Object.entries(cleaned).filter(([k]) => byKey.has(k)));
  const result = zodSchema.safeParse(known);
  if (result.success) return { values: result.data as Record<string, unknown>, unknown };
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    const field = byKey.get(key);
    if (field) errors[`${prefix}${key}`] ??= issueMessage(field, issue);
  }
  return { values: known, unknown };
}

function parsePrice(value: unknown): { price: string } | { error: string } {
  let n: number;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { error: "Enter a price in Tk" };
    if (Number(value.toFixed(2)) !== value) return { error: "Use at most 2 decimal places" };
    n = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    const s = value.trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(s)) return { error: "Enter a price in Tk, e.g. 1250 or 1250.50" };
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: "Use at most 2 decimal places" };
    n = Number(s);
  } else {
    return { error: "Price is required" };
  }
  if (n <= 0) return { error: "Price must be more than 0" };
  if (n > MAX_PRICE) return { error: `Price can't be more than Tk ${MAX_PRICE.toLocaleString("en-US")}` };
  return { price: n.toFixed(2) };
}

export function parseStock(value: unknown): { stock: number } | { error: string } {
  const n = typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
  if (n === undefined || n === null || n === "") return { error: "Stock is required" };
  if (typeof n !== "number" || !Number.isInteger(n)) return { error: "Stock must be a whole number" };
  if (n < 0) return { error: "Stock can't be negative" };
  if (n > MAX_STOCK) return { error: `Stock can't be more than ${MAX_STOCK.toLocaleString("en-US")}` };
  return { stock: n };
}

function text(value: unknown, field: string, label: string, min: number, max: number, errors: Record<string, string>): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length === 0) errors[field] = `${label} is required`;
  else if (s.length < min) errors[field] = `${label} must be at least ${min} characters`;
  else if (s.length > max) errors[field] = `${label} must be at most ${max} characters`;
  return s;
}

/**
 * Validates a create/edit body: { title, description, attributes, variants[{ id?, sku?, price,
 * stock, options }] }. Throws a 422 ProductError with field errors keyed like "title",
 * "attributes.socket", "variants.1.price"; an unknown attribute is named in the message.
 */
export function validateProductInput(schema: CategorySchema, body: unknown, today: Date): ProductInput {
  const errors: Record<string, string> = {};
  const input = isPlainObject(body) ? body : {};
  if (!isPlainObject(body)) errors.form = "Send the product as a JSON object";

  const title = text(input.title, "title", "Title", TITLE_MIN, TITLE_MAX, errors);
  const description = text(input.description, "description", "Description", 1, DESCRIPTION_MAX, errors);

  // Product-level attributes.
  const { productFields, variantFields } = formFields(schema);
  const axisNames = new Map(variantFields.map((f) => [f.key, f.name]));
  let attributes: Record<string, unknown> = {};
  let unknownAttributes: string[] = [];
  if (input.attributes !== undefined && !isPlainObject(input.attributes)) {
    errors.attributes = "Attributes must be an object of field values";
  } else {
    const checked = checkValues(
      productFields,
      buildListingZod(schema),
      (input.attributes as Record<string, unknown>) ?? {},
      "attributes.",
      (key) => (axisNames.has(key) ? `Set ${axisNames.get(key)} on each variant` : `Not an attribute of ${schema.name}`),
      errors,
    );
    attributes = checked.values;
    unknownAttributes = checked.unknown;
  }

  let expiresOn: Date | null = null;
  if (typeof attributes.expiry_date === "string" && !errors["attributes.expiry_date"]) {
    expiresOn = parseIsoDate(attributes.expiry_date);
    if (!expiresOn) errors["attributes.expiry_date"] = "Expiry date must be a real date (YYYY-MM-DD)";
    else if (expiresOn < today) errors["attributes.expiry_date"] = "This date has passed: expired goods may not be sold";
  }

  // Variants (US-031).
  const variants: VariantInput[] = [];
  const rawVariants = Array.isArray(input.variants) ? input.variants : null;
  const hasAxes = variantFields.length > 0;
  if (!rawVariants || rawVariants.length === 0) {
    errors.variants = hasAxes ? "Add at least one variant" : "Price and stock are required";
  } else if (!hasAxes && rawVariants.length !== 1) {
    errors.variants = "This category has no variant options: give exactly one price and stock";
  } else if (rawVariants.length > MAX_VARIANTS) {
    errors.variants = `At most ${MAX_VARIANTS} variants per product`;
  } else {
    const variantZod = buildVariantZod(schema);
    const seenOptions = new Map<string, number>();
    const seenSkus = new Map<string, number>();
    const seenIds = new Set<string>();
    rawVariants.forEach((raw, i) => {
      const p = `variants.${i}.`;
      const v = isPlainObject(raw) ? raw : {};
      if (!isPlainObject(raw)) errors[`variants.${i}`] = "Each variant must be an object";

      let id: string | undefined;
      if (v.id !== undefined && v.id !== null && v.id !== "") {
        if (typeof v.id !== "string" || seenIds.has(v.id)) errors[`${p}id`] = "Invalid or repeated variant id";
        else {
          id = v.id;
          seenIds.add(v.id);
        }
      }

      let sku: string | null = null;
      if (v.sku !== undefined && v.sku !== null) {
        if (typeof v.sku !== "string") errors[`${p}sku`] = "SKU must be text";
        else {
          sku = v.sku.trim() || null;
          if (sku && sku.length > SKU_MAX) errors[`${p}sku`] = `SKU must be at most ${SKU_MAX} characters`;
          else if (sku && seenSkus.has(sku)) errors[`${p}sku`] = `Same SKU as variant ${seenSkus.get(sku)! + 1}`;
          else if (sku) seenSkus.set(sku, i);
        }
      }

      const price = parsePrice(v.price);
      if ("error" in price) errors[`${p}price`] = price.error;
      const stock = parseStock(v.stock);
      if ("error" in stock) errors[`${p}stock`] = stock.error;

      let options: Record<string, unknown> = {};
      if (v.options !== undefined && !isPlainObject(v.options)) {
        errors[`${p}options`] = "Options must be an object of variant values";
      } else {
        const before = Object.keys(errors).length;
        options = checkValues(
          variantFields,
          variantZod,
          (v.options as Record<string, unknown>) ?? {},
          `${p}options.`,
          () => (hasAxes ? `Not a variant option of ${schema.name}` : `${schema.name} has no variant options`),
          errors,
        ).values;
        if (Object.keys(errors).length === before) {
          const key = optionKeyOf(options);
          if (seenOptions.has(key)) errors[`${p}options`] = `Same options as variant ${seenOptions.get(key)! + 1}`;
          else seenOptions.set(key, i);
        }
      }

      if ("price" in price && "stock" in stock) {
        variants.push({ id, sku, price: price.price, stock: stock.stock, options, optionKey: optionKeyOf(options), position: i });
      }
    });
  }

  if (Object.keys(errors).length > 0) {
    const message = unknownAttributes.length
      ? `${unknownAttributes.join(", ")} ${unknownAttributes.length === 1 ? "is not an attribute" : "are not attributes"} of ${schema.name}`
      : undefined;
    throw validationError(errors, message);
  }
  return { title, description, attributes, variants, expiresOn };
}
