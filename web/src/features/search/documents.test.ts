import { describe, expect, it } from "vitest";
import { buildSearchDocument, pathIds, type IndexField, type ProductForIndex } from "./documents";

const option = (label: string) => ({ value: label.toLowerCase(), label });
const shirtFields: IndexField[] = [
  { key: "brand", type: "enum", source: "attribute", options: [option("Yellow"), option("Easy")] },
  { key: "material", type: "enum", source: "attribute", options: [option("Cotton")] },
  { key: "size", type: "enum", source: "attribute", options: ["S", "M", "L"].map(option) },
  { key: "colour", type: "enum", source: "attribute", options: [option("Black"), option("White")] },
  { key: "tryon_eligible", type: "boolean", source: "attribute", options: [] },
  { key: "weight_g", type: "number", source: "guideline", options: [] },
  { key: "country_of_origin", type: "text", source: "guideline", options: [] },
  { key: "model", type: "text", source: "guideline", options: [] },
];

function shirt(overrides: Partial<ProductForIndex> = {}): ProductForIndex {
  return {
    id: "shirt1",
    title: "Oxford cotton shirt",
    bengaliName: "অক্সফোর্ড সুতি শার্ট",
    description: "Regular fit",
    attributes: { brand: "yellow", material: "cotton", tryon_eligible: true, weight_g: 250, country_of_origin: "Bangladesh", model: "OX-1" },
    createdAt: new Date("2026-10-01T00:00:00Z"),
    shop: { id: "s1", slug: "fashion", name: "Fashion Shop" },
    category: { id: "shirts", slug: "mens-shirts", name: "Men's Shirts", path: "/fashion/shirts/" },
    categoryNames: ["Fashion", "Men's Shirts"],
    variants: [
      { price: "1850.00", stock: 6, options: { size: "s", colour: "black" } },
      { price: { toString: () => "1950.00" }, stock: 2, options: { size: "l", colour: "white" } },
      { price: 1500, stock: 0, options: { size: "m", colour: "black" } },
    ],
    images: [{ id: "img-cover" }, { id: "img-2" }],
    ...overrides,
  };
}

describe("search document builder", () => {
  it("one document per product: prices and variant values from in-stock variants only", () => {
    const d = buildSearchDocument(shirt(), shirtFields)!;
    expect(d).toMatchObject({
      id: "shirt1",
      priceMin: 1850,
      priceMax: 1950,
      inStock: true,
      coverImageId: "img-cover",
      shopSlug: "fashion",
      shopName: "Fashion Shop",
      categoryId: "shirts",
      categoryPath: ["fashion", "shirts"],
      categoryNames: ["Fashion", "Men's Shirts"],
      createdAt: Date.parse("2026-10-01T00:00:00Z"),
      rating: null,
    });
    // Size M is out of stock, so it is not a filter value.
    expect(d.attrs.size).toEqual(["s", "l"]);
    expect(d.attrs.colour).toEqual(["black", "white"]);
  });

  it("flattens attribute values for filters: options, numbers, yes/no; guideline fields are not filters", () => {
    const d = buildSearchDocument(shirt(), shirtFields)!;
    expect(d.attrs).toEqual({ brand: ["yellow"], material: ["cotton"], tryon_eligible: true, size: ["s", "l"], colour: ["black", "white"] });
    expect(d.attrs.weight_g).toBeUndefined();
  });

  it("makes brand, Bengali name, option labels and the model number searchable", () => {
    const d = buildSearchDocument(shirt(), shirtFields)!;
    expect(d.brand).toBe("Yellow");
    expect(d.bengaliName).toBe("অক্সফোর্ড সুতি শার্ট".normalize("NFC"));
    expect(d.keywords).toContain("OX-1");
    expect(d.keywords).toContain("Cotton");
    expect(d.keywords).not.toContain("Bangladesh"); // origin is noise for keyword search
  });

  it("keeps a free-text brand (books use the guideline Brand field) and short text attributes as filter values", () => {
    const fields: IndexField[] = [
      { key: "author", type: "text", source: "attribute", options: [] },
      { key: "page_count", type: "number", source: "attribute", options: [] },
      { key: "brand", type: "text", source: "guideline", options: [] },
      { key: "blurb", type: "text", source: "attribute", options: [] },
    ];
    const d = buildSearchDocument(
      shirt({ attributes: { author: "Humayun Ahmed", page_count: 120, brand: "Anyaprokash", blurb: "x".repeat(150), unknown_key: "ignored" }, variants: [{ price: "250", stock: 4, options: {} }] }),
      fields,
    )!;
    expect(d.brand).toBe("Anyaprokash");
    expect(d.attrs).toEqual({ author: ["Humayun Ahmed"], page_count: [120] });
    expect(d.keywords).toContain("Humayun Ahmed");
    expect(d.keywords).toContain("x".repeat(150)); // searchable, not a filter value
  });

  it("returns null when no variant is in stock (only in-stock products are searchable)", () => {
    expect(buildSearchDocument(shirt({ variants: [{ price: "10", stock: 0, options: {} }] }), shirtFields)).toBeNull();
  });

  it("has no cover without images", () => {
    expect(buildSearchDocument(shirt({ images: [] }), shirtFields)!.coverImageId).toBeNull();
  });

  it("splits materialised paths", () => {
    expect(pathIds("/a/b/c/")).toEqual(["a", "b", "c"]);
    expect(pathIds("")).toEqual([]);
  });
});
