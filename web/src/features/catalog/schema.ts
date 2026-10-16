import { z } from "zod";
import type { AttributeOptionStatus, AttributeType, FilterWidget } from "@/generated/prisma/enums";
import { CatalogError } from "./errors";

/**
 * Effective form definition of a leaf category (ADR-001): its assigned attributes plus the
 * Bangladesh guideline fields every listing needs (US-023). The seller form, the server check
 * (Zod, below) and later the filter panel all read this one definition.
 */

export type FieldType = AttributeType | "date";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  name: string;
  type: FieldType;
  unit: string | null;
  required: boolean;
  options: FieldOption[];
  source: "guideline" | "attribute";
  filterable: boolean;
  filterWidget: FilterWidget | null;
  displayOrder: number;
  isVariantAxis: boolean;
}

export interface CategorySchema {
  categoryId: string;
  name: string;
  isOther: boolean;
  requiresLicence: boolean;
  requiresExpiry: boolean;
  fields: FieldDef[];
}

export interface SchemaInput {
  category: {
    id: string;
    name: string;
    isLeaf: boolean;
    isOther: boolean;
    archivedAt: Date | null;
    requiresLicence: boolean;
    requiresExpiry: boolean;
  };
  assignments: {
    required: boolean;
    filterable: boolean;
    filterWidget: FilterWidget | null;
    displayOrder: number;
    isVariantAxis: boolean;
    attribute: {
      key: string;
      name: string;
      type: AttributeType;
      unit: string | null;
      archivedAt: Date | null;
      options: { value: string; label: string; status: AttributeOptionStatus }[];
    };
  }[];
}

function guideline(key: string, name: string, type: FieldType, required: boolean, extra: Partial<FieldDef> = {}): FieldDef {
  return {
    key,
    name,
    type,
    unit: null,
    required,
    options: [],
    source: "guideline",
    filterable: false,
    filterWidget: null,
    displayOrder: 0,
    isVariantAxis: false,
    ...extra,
  };
}

/** Required listing fields from the Digital Commerce Guidelines 2021 (US-023). */
export const GUIDELINE_FIELDS: readonly FieldDef[] = [
  guideline("quantity", "Quantity", "number", true),
  guideline("quantity_unit", "Unit", "enum", true, {
    options: ["pcs", "pack", "set", "pair", "g", "kg", "ml", "l"].map((v) => ({ value: v, label: v })),
  }),
  guideline("weight_g", "Weight (for delivery charge)", "number", true, { unit: "g" }),
  guideline("brand", "Brand", "text", true),
  guideline("model", "Model", "text", false),
  guideline("country_of_origin", "Country of origin", "text", true),
  guideline("ingredients_materials", "Ingredients or materials", "text", false),
  guideline("return_eligibility", "Return eligibility", "enum", true, {
    options: [
      { value: "eligible", label: "Returnable" },
      { value: "change_of_mind", label: "Returnable, including change of mind" },
      { value: "excluded", label: "Not returnable" },
    ],
  }),
  guideline("warranty", "Warranty", "text", false),
];

export const EXPIRY_FIELD: FieldDef = guideline("expiry_date", "Expiry date", "date", true);

/**
 * Builds the effective schema. Throws 422 for a non-leaf or archived category.
 * "Other" leaves get only the common fields. Archived attributes and pending options are
 * left out (they stay readable elsewhere). An attribute with a guideline key (e.g. an enum
 * "brand") replaces the free-text guideline field and stays required.
 */
export function buildEffectiveSchema({ category, assignments }: SchemaInput): CategorySchema {
  if (!category.isLeaf) {
    throw new CatalogError(422, "CATEGORY_NOT_LEAF", "Products can only be listed in a leaf category");
  }
  if (category.archivedAt) {
    throw new CatalogError(422, "CATEGORY_ARCHIVED", "This category is archived");
  }

  const guidelineKeys = new Set(GUIDELINE_FIELDS.map((f) => f.key));
  const attributeFields: FieldDef[] = category.isOther
    ? []
    : assignments
        .filter((a) => !a.attribute.archivedAt)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((a) => ({
          key: a.attribute.key,
          name: a.attribute.name,
          type: a.attribute.type,
          unit: a.attribute.unit,
          required: a.required || guidelineKeys.has(a.attribute.key),
          options: a.attribute.options
            .filter((o) => o.status === "active")
            .map(({ value, label }) => ({ value, label })),
          source: "attribute",
          filterable: a.filterable,
          filterWidget: a.filterWidget,
          displayOrder: a.displayOrder,
          isVariantAxis: a.isVariantAxis,
        }));

  const overridden = new Set(attributeFields.map((f) => f.key));
  const common = [...GUIDELINE_FIELDS, ...(category.requiresExpiry ? [EXPIRY_FIELD] : [])].filter(
    (f) => !overridden.has(f.key),
  );

  return {
    categoryId: category.id,
    name: category.name,
    isOther: category.isOther,
    requiresLicence: category.requiresLicence,
    requiresExpiry: category.requiresExpiry,
    fields: [...attributeFields, ...common],
  };
}

function fieldZod(field: FieldDef): z.ZodType {
  const values = new Set(field.options.map((o) => o.value));
  const option = z.string().refine((v) => values.has(v), { message: `Not an allowed ${field.name} option` });
  let schema: z.ZodType;
  switch (field.type) {
    case "enum":
      schema = option;
      break;
    case "multi_enum":
      schema = z.array(option).min(field.required ? 1 : 0);
      break;
    case "number":
      schema = z.number().nonnegative();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "text":
      schema = z.string().trim().min(1).max(2000);
      break;
    case "date":
      schema = z.iso.date();
      break;
  }
  return field.required ? schema : schema.optional();
}

function strictObjectFor(fields: FieldDef[]) {
  return z.strictObject(Object.fromEntries(fields.map((f) => [f.key, fieldZod(f)])));
}

/** Product-level values (everything except variant axes). Unknown keys are rejected. */
export function buildListingZod(schema: CategorySchema) {
  return strictObjectFor(schema.fields.filter((f) => !f.isVariantAxis));
}

/** Per-SKU values for the variant axes (e.g. size, colour). Unknown keys are rejected. */
export function buildVariantZod(schema: CategorySchema) {
  return strictObjectFor(schema.fields.filter((f) => f.isVariantAxis));
}
