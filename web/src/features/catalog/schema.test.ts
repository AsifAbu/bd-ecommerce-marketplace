import { describe, expect, it } from "vitest";
import { CatalogError } from "./errors";
import { buildEffectiveSchema, buildListingZod, buildVariantZod, GUIDELINE_FIELDS, type SchemaInput } from "./schema";

const leaf: SchemaInput["category"] = {
  id: "cpu",
  name: "Processor",
  isLeaf: true,
  isOther: false,
  archivedAt: null,
  requiresLicence: false,
  requiresExpiry: false,
};

function assign(
  key: string,
  type: SchemaInput["assignments"][number]["attribute"]["type"],
  opts: Partial<SchemaInput["assignments"][number]> & { options?: string[]; pending?: string[]; archived?: boolean } = {},
): SchemaInput["assignments"][number] {
  return {
    required: opts.required ?? false,
    filterable: opts.filterable ?? true,
    filterWidget: null,
    displayOrder: opts.displayOrder ?? 1,
    isVariantAxis: opts.isVariantAxis ?? false,
    attribute: {
      key,
      name: key,
      type,
      unit: null,
      archivedAt: opts.archived ? new Date() : null,
      options: [
        ...(opts.options ?? []).map((v) => ({ value: v, label: v.toUpperCase(), status: "active" as const })),
        ...(opts.pending ?? []).map((v) => ({ value: v, label: v, status: "pending" as const })),
      ],
    },
  };
}

const processor: SchemaInput = {
  category: leaf,
  assignments: [
    assign("socket", "enum", { required: true, options: ["am5", "lga1700"], pending: ["am6"], displayOrder: 2 }),
    assign("brand", "enum", { required: false, options: ["amd", "intel"], displayOrder: 1 }),
    assign("core_count", "number", { required: true, displayOrder: 3 }),
    assign("integrated_graphics", "boolean", { displayOrder: 4 }),
    assign("old_field", "text", { required: true, archived: true, displayOrder: 5 }),
  ],
};

const validListing = {
  brand: "amd",
  socket: "am5",
  core_count: 8,
  integrated_graphics: true,
  quantity: 1,
  quantity_unit: "pcs",
  weight_g: 300,
  country_of_origin: "China",
  return_eligibility: "eligible",
};

describe("buildEffectiveSchema", () => {
  it("adds every guideline field to every leaf (US-023)", () => {
    const keys = buildEffectiveSchema({ category: leaf, assignments: [] }).fields.map((f) => f.key);
    expect(keys).toEqual(GUIDELINE_FIELDS.map((f) => f.key));
    expect(keys).toEqual(
      expect.arrayContaining([
        "quantity",
        "quantity_unit",
        "weight_g",
        "brand",
        "model",
        "country_of_origin",
        "ingredients_materials",
        "return_eligibility",
        "warranty",
      ]),
    );
  });

  it("adds a required expiry date only when the category requires it", () => {
    expect(buildEffectiveSchema({ category: leaf, assignments: [] }).fields.some((f) => f.key === "expiry_date")).toBe(false);
    const medicine = buildEffectiveSchema({ category: { ...leaf, requiresExpiry: true }, assignments: [] });
    expect(medicine.fields.find((f) => f.key === "expiry_date")).toMatchObject({ type: "date", required: true });
  });

  it("orders attributes by display order, then the guideline fields", () => {
    const keys = buildEffectiveSchema(processor).fields.map((f) => f.key);
    expect(keys.slice(0, 4)).toEqual(["brand", "socket", "core_count", "integrated_graphics"]);
  });

  it("lets a brand enum replace the free-text guideline brand and keeps it required", () => {
    const fields = buildEffectiveSchema(processor).fields.filter((f) => f.key === "brand");
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ type: "enum", source: "attribute", required: true });
  });

  it("leaves out archived attributes and pending options", () => {
    const schema = buildEffectiveSchema(processor);
    expect(schema.fields.some((f) => f.key === "old_field")).toBe(false);
    expect(schema.fields.find((f) => f.key === "socket")!.options.map((o) => o.value)).toEqual(["am5", "lga1700"]);
  });

  it("gives an \"Other\" leaf only the common fields (US-024)", () => {
    const other = buildEffectiveSchema({ ...processor, category: { ...leaf, isOther: true } });
    expect(other.fields.every((f) => f.source === "guideline")).toBe(true);
  });

  it("rejects non-leaf and archived categories with 422", () => {
    for (const category of [{ ...leaf, isLeaf: false }, { ...leaf, archivedAt: new Date() }]) {
      const err = (() => {
        try {
          buildEffectiveSchema({ category, assignments: [] });
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(CatalogError);
      expect((err as CatalogError).status).toBe(422);
    }
  });
});

describe("buildListingZod", () => {
  const zod = buildListingZod(buildEffectiveSchema(processor));

  it("accepts a valid payload", () => {
    expect(zod.safeParse(validListing).success).toBe(true);
    expect(zod.safeParse({ ...validListing, model: "7700X", warranty: "3 years" }).success).toBe(true);
  });

  it("rejects missing required fields", () => {
    for (const key of ["socket", "core_count", "quantity", "weight_g", "country_of_origin", "return_eligibility", "brand"]) {
      const payload: Record<string, unknown> = { ...validListing };
      delete payload[key];
      const result = zod.safeParse(payload);
      expect(result.success, key).toBe(false);
      expect(result.error!.issues[0].path).toEqual([key]);
    }
  });

  it("rejects unknown attributes, including archived ones", () => {
    expect(zod.safeParse({ ...validListing, page_count: 300 }).success).toBe(false);
    expect(zod.safeParse({ ...validListing, old_field: "x" }).success).toBe(false);
  });

  it("rejects enum values that are not active options and wrong types", () => {
    expect(zod.safeParse({ ...validListing, socket: "am6" }).success).toBe(false); // pending
    expect(zod.safeParse({ ...validListing, brand: "AMD " }).success).toBe(false);
    expect(zod.safeParse({ ...validListing, core_count: "8" }).success).toBe(false);
    expect(zod.safeParse({ ...validListing, return_eligibility: "maybe" }).success).toBe(false);
  });

  it("requires a valid expiry date when the category needs one", () => {
    const med = buildListingZod(buildEffectiveSchema({ category: { ...leaf, requiresExpiry: true }, assignments: [] }));
    const base = { ...validListing, brand: "Square" };
    delete (base as Record<string, unknown>).socket;
    delete (base as Record<string, unknown>).core_count;
    delete (base as Record<string, unknown>).integrated_graphics;
    expect(med.safeParse(base).success).toBe(false);
    expect(med.safeParse({ ...base, expiry_date: "31/12/2027" }).success).toBe(false);
    expect(med.safeParse({ ...base, expiry_date: "2027-12-31" }).success).toBe(true);
  });
});

describe("buildVariantZod", () => {
  const fashion = buildEffectiveSchema({
    category: { ...leaf, name: "Men's Pants" },
    assignments: [
      assign("size", "enum", { required: true, options: ["30", "32"], isVariantAxis: true }),
      assign("colour", "enum", { required: true, options: ["black"], isVariantAxis: true }),
    ],
  });

  it("validates variant axes per SKU, not on the product", () => {
    expect(buildVariantZod(fashion).safeParse({ size: "32", colour: "black" }).success).toBe(true);
    expect(buildVariantZod(fashion).safeParse({ size: "32" }).success).toBe(false);
    expect(buildVariantZod(fashion).safeParse({ size: "32", colour: "black", fit: "slim" }).success).toBe(false);
    expect(buildListingZod(fashion).safeParse({ ...validListing, brand: "Easy" }).success).toBe(false); // processor keys unknown
    expect(Object.keys(buildListingZod(fashion).shape)).not.toContain("size");
  });
});
