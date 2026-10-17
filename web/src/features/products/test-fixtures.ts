import type { AttributeType } from "@/generated/prisma/enums";
import { buildEffectiveSchema, type CategorySchema } from "@/features/catalog";

/** Test helper: category schemas shaped like the seeded catalog (Processor, Men's Shirts, Pain Relief). */

type Attr = [key: string, name: string, type: AttributeType, options?: string[], unit?: string];
type Assign = [attr: Attr, required: boolean, isVariantAxis?: boolean];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function schema(
  id: string,
  name: string,
  assigns: Assign[],
  flags: { isLeaf?: boolean; requiresLicence?: boolean; requiresExpiry?: boolean } = {},
): CategorySchema {
  return buildEffectiveSchema({
    category: {
      id,
      name,
      isLeaf: flags.isLeaf ?? true,
      isOther: false,
      archivedAt: null,
      requiresLicence: flags.requiresLicence ?? false,
      requiresExpiry: flags.requiresExpiry ?? false,
    },
    assignments: assigns.map(([[key, attrName, type, options = [], unit], required, isVariantAxis = false], i) => ({
      required,
      filterable: true,
      filterWidget: null,
      displayOrder: i + 1,
      isVariantAxis,
      attribute: {
        key,
        name: attrName,
        type,
        unit: unit ?? null,
        archivedAt: null,
        options: options.map((label) => ({ value: slug(label), label, status: "active" as const })),
      },
    })),
  });
}

const BRAND: Attr = ["brand", "Brand", "enum", ["AMD", "Intel", "Yellow", "Square"]];

export const processorSchema = () =>
  schema("cat-processor", "Processor", [
    [BRAND, true],
    [["socket", "Socket", "enum", ["AM4", "AM5", "LGA1700"]], true],
    [["core_count", "Core count", "number"], true],
    [["base_clock_ghz", "Base clock", "number", [], "GHz"], true],
    [["tdp_w", "TDP", "number", [], "W"], false],
    [["integrated_graphics", "Integrated graphics", "boolean"], false],
    [["model_number", "Model number", "text"], false],
  ]);

export const shirtSchema = () =>
  schema("cat-shirts", "Men's Shirts", [
    [BRAND, true],
    [["material", "Material", "enum", ["Cotton", "Linen"]], true],
    [["size", "Size", "enum", ["S", "M", "L", "XL"]], true, true],
    [["colour", "Colour", "enum", ["Black", "White", "Navy Blue"]], true, true],
    [["features", "Features", "multi_enum", ["Wrinkle free", "Stretch", "Pocket"]], false],
  ]);

export const painReliefSchema = () =>
  schema(
    "cat-pain",
    "Pain Relief",
    [
      [BRAND, true],
      [["generic_name", "Generic name", "enum", ["Paracetamol", "Ibuprofen"]], true],
      [["strength_mg", "Strength", "number", [], "mg"], true],
    ],
    { requiresLicence: true, requiresExpiry: true },
  );

/** Building the schema of a non-leaf category throws (422), like getCategorySchema. */
export const nonLeafSchema = () => schema("cat-components", "Computer Components", [], { isLeaf: false });

/** Values for every required guideline field. */
export const GUIDELINE_VALUES = {
  quantity: 1,
  quantity_unit: "pcs",
  weight_g: 300,
  country_of_origin: "China",
  return_eligibility: "eligible",
};

export const validProcessor = (overrides: Record<string, unknown> = {}) => ({
  categoryId: "cat-processor",
  title: "AMD Ryzen 5 7600 Processor",
  description: "6 cores, 12 threads, boxed with cooler.",
  attributes: { ...GUIDELINE_VALUES, brand: "amd", socket: "am5", core_count: 6, base_clock_ghz: 3.8 },
  variants: [{ sku: "R5-7600", price: 24500, stock: 10, options: {} }],
  ...overrides,
});

export const validShirt = (overrides: Record<string, unknown> = {}) => ({
  categoryId: "cat-shirts",
  title: "Oxford cotton shirt",
  description: "Regular fit, long sleeves.",
  attributes: { ...GUIDELINE_VALUES, brand: "yellow", material: "cotton" },
  variants: [
    { sku: "OX-M-BLK", price: 1850, stock: 5, options: { size: "m", colour: "black" } },
    { sku: "OX-L-BLK", price: 1850, stock: 3, options: { size: "l", colour: "black" } },
  ],
  ...overrides,
});

export const validMedicine = (overrides: Record<string, unknown> = {}) => ({
  categoryId: "cat-pain",
  title: "Napa 500 mg tablets",
  description: "Paracetamol 500 mg, strip of 10.",
  attributes: { ...GUIDELINE_VALUES, brand: "square", generic_name: "paracetamol", strength_mg: 500, expiry_date: "2027-06-30" },
  variants: [{ price: 12, stock: 200, options: {} }],
  ...overrides,
});

/** 16 Oct 2026, 18:00 in Dhaka. */
export const NOW = new Date("2026-10-16T12:00:00Z");
export const TODAY = new Date("2026-10-16T00:00:00Z");
