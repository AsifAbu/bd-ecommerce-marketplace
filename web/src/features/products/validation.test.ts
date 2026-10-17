import { describe, expect, it } from "vitest";
import { ProductError } from "./errors";
import {
  processorSchema,
  shirtSchema,
  painReliefSchema,
  TODAY,
  validMedicine,
  validProcessor,
  validShirt,
} from "./test-fixtures";
import { formFields, optionKeyOf, parseIsoDate, validateProductInput } from "./validation";

function errorOf(fn: () => unknown): ProductError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ProductError) return err;
    throw err;
  }
  throw new Error("expected a ProductError");
}

describe("formFields (US-030: the generated form)", () => {
  it("shows exactly Processor's attributes plus the required guideline fields, in display order", () => {
    const { productFields, variantFields } = formFields(processorSchema());
    expect(productFields.map((f) => f.key)).toEqual([
      // Processor's assigned attributes, by display order ("brand" replaces the guideline brand)
      "brand",
      "socket",
      "core_count",
      "base_clock_ghz",
      "tdp_w",
      "integrated_graphics",
      "model_number",
      // guideline fields (US-023)
      "quantity",
      "quantity_unit",
      "weight_g",
      "model",
      "country_of_origin",
      "ingredients_materials",
      "return_eligibility",
      "warranty",
    ]);
    expect(variantFields).toEqual([]);
    expect(productFields.filter((f) => f.required).map((f) => f.key)).toEqual([
      "brand",
      "socket",
      "core_count",
      "base_clock_ghz",
      "quantity",
      "quantity_unit",
      "weight_g",
      "country_of_origin",
      "return_eligibility",
    ]);
  });

  it("puts variant axes (size, colour) in the variant rows, not the product fields", () => {
    const { productFields, variantFields } = formFields(shirtSchema());
    expect(variantFields.map((f) => f.key)).toEqual(["size", "colour"]);
    expect(productFields.map((f) => f.key)).not.toContain("size");
  });

  it("adds the expiry date for medicine", () => {
    expect(formFields(painReliefSchema()).productFields.map((f) => f.key)).toContain("expiry_date");
  });
});

describe("validateProductInput", () => {
  it("accepts a complete processor and normalises price and text", () => {
    const input = validateProductInput(
      processorSchema(),
      validProcessor({ title: "  AMD Ryzen 5 7600  ", variants: [{ sku: " R5 ", price: "24,500.5", stock: "10" }] }),
      TODAY,
    );
    expect(input.title).toBe("AMD Ryzen 5 7600");
    expect(input.attributes).toMatchObject({ brand: "amd", socket: "am5", core_count: 6 });
    expect(input.variants).toEqual([{ id: undefined, sku: "R5", price: "24500.50", stock: 10, options: {}, optionKey: "", position: 0 }]);
    expect(input.expiresOn).toBeNull();
  });

  it("takes an optional Bengali name (searchable, US-045)", () => {
    expect(validateProductInput(processorSchema(), validProcessor(), TODAY).bengaliName).toBeNull();
    expect(validateProductInput(processorSchema(), validProcessor({ bengaliName: "  " }), TODAY).bengaliName).toBeNull();
    expect(validateProductInput(processorSchema(), validProcessor({ bengaliName: " প্রসেসর " }), TODAY).bengaliName).toBe("প্রসেসর");
    expect(() => validateProductInput(processorSchema(), validProcessor({ bengaliName: "ক".repeat(201) }), TODAY)).toThrow(/at most 200/);
    expect(() => validateProductInput(processorSchema(), validProcessor({ bengaliName: 5 }), TODAY)).toThrow(ProductError);
  });

  it("blocks the save when a required attribute is empty, with an error on that field", () => {
    const body = validProcessor();
    (body.attributes as Record<string, unknown>).socket = "";
    delete (body.attributes as Record<string, unknown>).core_count;
    const err = errorOf(() => validateProductInput(processorSchema(), body, TODAY));
    expect(err.status).toBe(422);
    expect(err.fields).toEqual({ "attributes.socket": "Socket is required", "attributes.core_count": "Core count is required" });
  });

  it("rejects an attribute that does not belong to the category with a 422 naming it", () => {
    const body = validProcessor();
    (body.attributes as Record<string, unknown>).isbn = "978-984";
    const err = errorOf(() => validateProductInput(processorSchema(), body, TODAY));
    expect(err.status).toBe(422);
    expect(err.message).toBe("isbn is not an attribute of Processor");
    expect(err.fields).toEqual({ "attributes.isbn": "Not an attribute of Processor" });
  });

  it("rejects invalid values by type", () => {
    const body = validProcessor();
    Object.assign(body.attributes, { socket: "lga9999", core_count: "six", integrated_graphics: "yes", tdp_w: -5 });
    const err = errorOf(() => validateProductInput(processorSchema(), body, TODAY));
    expect(err.fields).toEqual({
      "attributes.socket": "Not an allowed Socket option",
      "attributes.core_count": "Core count must be a number",
      "attributes.integrated_graphics": "Choose yes or no for Integrated graphics",
      "attributes.tdp_w": "TDP can't be negative",
    });
  });

  it("checks title, description, price and stock", () => {
    const err = errorOf(() =>
      validateProductInput(
        processorSchema(),
        validProcessor({ title: "ab", description: " ", variants: [{ price: 0, stock: -1 }] }),
        TODAY,
      ),
    );
    expect(err.fields).toMatchObject({
      title: "Title must be at least 3 characters",
      description: "Description is required",
      "variants.0.price": "Price must be more than 0",
      "variants.0.stock": "Stock can't be negative",
    });
    const decimals = errorOf(() => validateProductInput(processorSchema(), validProcessor({ variants: [{ price: 10.555, stock: 1.5 }] }), TODAY));
    expect(decimals.fields).toEqual({ "variants.0.price": "Use at most 2 decimal places", "variants.0.stock": "Stock must be a whole number" });
  });

  it("a category without variant axes takes exactly one variant without options", () => {
    const two = errorOf(() =>
      validateProductInput(processorSchema(), validProcessor({ variants: [{ price: 1, stock: 1 }, { price: 2, stock: 1 }] }), TODAY),
    );
    expect(two.fields).toEqual({ variants: "This category has no variant options: give exactly one price and stock" });
    const withOptions = errorOf(() =>
      validateProductInput(processorSchema(), validProcessor({ variants: [{ price: 1, stock: 1, options: { size: "m" } }] }), TODAY),
    );
    expect(withOptions.fields).toEqual({ "variants.0.options.size": "Processor has no variant options" });
  });
});

describe("variants (US-031)", () => {
  it("accepts size/colour variants with their own price and stock", () => {
    const input = validateProductInput(shirtSchema(), validShirt(), TODAY);
    expect(input.variants.map((v) => [v.optionKey, v.price, v.stock])).toEqual([
      ["colour=black;size=m", "1850.00", 5],
      ["colour=black;size=l", "1850.00", 3],
    ]);
  });

  it("requires every axis and rejects unknown option values and keys", () => {
    const err = errorOf(() =>
      validateProductInput(
        shirtSchema(),
        validShirt({ variants: [{ price: 1, stock: 1, options: { size: "xxxl" } }, { price: 1, stock: 1, options: { size: "m", colour: "black", fit: "slim" } }] }),
        TODAY,
      ),
    );
    expect(err.fields).toEqual({
      "variants.0.options.size": "Not an allowed Size option",
      "variants.0.options.colour": "Colour is required",
      "variants.1.options.fit": "Not a variant option of Men's Shirts",
    });
  });

  it("rejects two variants with the same combination or the same SKU", () => {
    const err = errorOf(() =>
      validateProductInput(
        shirtSchema(),
        validShirt({
          variants: [
            { sku: "A", price: 1, stock: 1, options: { size: "m", colour: "black" } },
            { sku: "A", price: 1, stock: 1, options: { colour: "black", size: "m" } },
          ],
        }),
        TODAY,
      ),
    );
    expect(err.fields).toEqual({ "variants.1.sku": "Same SKU as variant 1", "variants.1.options": "Same options as variant 1" });
  });

  it("needs 1 to 100 variants", () => {
    expect(errorOf(() => validateProductInput(shirtSchema(), validShirt({ variants: [] }), TODAY)).fields).toEqual({
      variants: "Add at least one variant",
    });
    const many = Array.from({ length: 101 }, (_, i) => ({ price: 1, stock: 1, options: { size: "m", colour: String(i) } }));
    expect(errorOf(() => validateProductInput(shirtSchema(), validShirt({ variants: many }), TODAY)).fields).toEqual({
      variants: "At most 100 variants per product",
    });
  });

  it("tells the seller a variant axis sent as a product attribute belongs on the variants", () => {
    const body = validShirt();
    (body.attributes as Record<string, unknown>).size = "m";
    expect(errorOf(() => validateProductInput(shirtSchema(), body, TODAY)).fields).toEqual({
      "attributes.size": "Set Size on each variant",
    });
  });

  it("optionKeyOf is order-independent", () => {
    expect(optionKeyOf({ size: "m", colour: "black" })).toBe(optionKeyOf({ colour: "black", size: "m" }));
    expect(optionKeyOf({})).toBe("");
  });
});

describe("expiry (guidelines: expired goods may not be sold)", () => {
  it("requires an expiry date for medicine and copies it to expiresOn", () => {
    const body = validMedicine();
    delete (body.attributes as Record<string, unknown>).expiry_date;
    expect(errorOf(() => validateProductInput(painReliefSchema(), body, TODAY)).fields).toEqual({
      "attributes.expiry_date": "Expiry date is required",
    });
    expect(validateProductInput(painReliefSchema(), validMedicine(), TODAY).expiresOn).toEqual(new Date("2027-06-30T00:00:00Z"));
  });

  it("rejects an expiry date in the past; today is still allowed", () => {
    const past = validMedicine();
    (past.attributes as Record<string, unknown>).expiry_date = "2026-10-15";
    expect(errorOf(() => validateProductInput(painReliefSchema(), past, TODAY)).fields).toEqual({
      "attributes.expiry_date": "This date has passed: expired goods may not be sold",
    });
    const today = validMedicine();
    (today.attributes as Record<string, unknown>).expiry_date = "2026-10-16";
    expect(validateProductInput(painReliefSchema(), today, TODAY).expiresOn).toEqual(TODAY);
  });

  it("parseIsoDate rejects impossible dates", () => {
    expect(parseIsoDate("2027-02-30")).toBeNull();
    expect(parseIsoDate("30/06/2027")).toBeNull();
    expect(parseIsoDate("2027-02-28")).toEqual(new Date("2027-02-28T00:00:00Z"));
  });
});
