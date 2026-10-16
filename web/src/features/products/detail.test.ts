import { describe, expect, it, vi } from "vitest";
import { CatalogError } from "@/features/catalog";
import { buildProductPage, createProductPageLoader, formatDate, type DetailRow } from "./detail";
import { NOW, painReliefSchema, processorSchema, shirtSchema, TODAY } from "./test-fixtures";

const shirtRow = (overrides: Partial<DetailRow> = {}): DetailRow => ({
  id: "p-shirt",
  title: "Oxford cotton shirt",
  description: "Regular fit.",
  attributes: {
    quantity: 1,
    quantity_unit: "pcs",
    weight_g: 250,
    brand: "yellow",
    material: "cotton",
    features: ["pocket", "stretch"],
    country_of_origin: "Bangladesh",
    ingredients_materials: "100% cotton",
    warranty: "None",
    return_eligibility: "change_of_mind",
  },
  expiresOn: null,
  category: { id: "cat-shirts", name: "Men's Shirts", path: "/cat-fashion/cat-men/cat-shirts/" },
  shop: { id: "s1", name: "Test Fashion Shop", slug: "test-fashion-shop", tier: "verified" },
  variants: [
    { id: "v-l-white", price: "1950.00", stock: 0, options: { size: "l", colour: "white" }, position: 3 },
    { id: "v-m-black", price: "1850.00", stock: 6, options: { size: "m", colour: "black" }, position: 0 },
    { id: "v-m-white", price: "1850.00", stock: 2, options: { size: "m", colour: "white" }, position: 1 },
    { id: "v-l-black", price: "1950.00", stock: 4, options: { size: "l", colour: "black" }, position: 2 },
  ],
  images: [{ id: "img-cover" }, { id: "img-2" }],
  ...overrides,
});

const trail = [
  { id: "cat-shirts", name: "Men's Shirts" },
  { id: "cat-fashion", name: "Fashion" },
  { id: "cat-men", name: "Men" },
];

describe("buildProductPage", () => {
  it("lists specs in schema display order with labels, units and option labels", () => {
    const page = buildProductPage(shirtRow(), shirtSchema(), trail);
    expect(page.specs).toEqual([
      { key: "brand", label: "Brand", value: "Yellow" },
      { key: "material", label: "Material", value: "Cotton" },
      { key: "features", label: "Features", value: "Pocket, Stretch" },
      // Guideline fields follow the category's attributes.
      { key: "quantity", label: "Quantity", value: "1 pcs" },
      { key: "weight_g", label: "Weight", value: "250 g" },
      { key: "country_of_origin", label: "Country of origin", value: "Bangladesh" },
      { key: "ingredients_materials", label: "Ingredients or materials", value: "100% cotton" },
      { key: "warranty", label: "Warranty", value: "None" },
    ]);
    // Variant axes are chosen in the picker, not listed as specs.
    expect(page.specs.map((s) => s.key)).not.toContain("size");
  });

  it("formats numbers with units and booleans, and skips empty optional fields", () => {
    const row = shirtRow({
      attributes: { brand: "amd", socket: "am5", core_count: 6, base_clock_ghz: 3.8, integrated_graphics: true, quantity: 1, quantity_unit: "pcs", weight_g: 1200, country_of_origin: "China", return_eligibility: "eligible", model: "" },
      variants: [{ id: "v1", price: "24500.00", stock: 12, options: {}, position: 0 }],
    });
    const page = buildProductPage(row, processorSchema(), []);
    const specs = Object.fromEntries(page.specs.map((s) => [s.label, s.value]));
    expect(specs).toMatchObject({ Socket: "AM5", "Core count": "6", "Base clock": "3.8 GHz", "Integrated graphics": "Yes", Weight: "1,200 g" });
    expect(specs).not.toHaveProperty("Model");
    expect(specs).not.toHaveProperty("TDP");
    expect(page.axes).toEqual([]);
    expect(page.variants).toHaveLength(1);
  });

  it("shows the expiry date of medicine", () => {
    const row = shirtRow({
      attributes: { brand: "square", generic_name: "paracetamol", strength_mg: 500, quantity: 10, quantity_unit: "pcs", weight_g: 20, country_of_origin: "Bangladesh", return_eligibility: "excluded", expiry_date: "2027-06-30" },
      expiresOn: new Date("2027-06-30T00:00:00Z"),
      variants: [{ id: "v1", price: "12.00", stock: 200, options: {}, position: 0 }],
    });
    const page = buildProductPage(row, painReliefSchema(), []);
    expect(page.specs.find((s) => s.key === "expiry_date")).toEqual({ key: "expiry_date", label: "Expiry date", value: "30 Jun 2027" });
    expect(page.expiresOn).toBe("2027-06-30");
    expect(page.returns).toMatchObject({ value: "excluded", label: "Not returnable" });
  });

  it("gives variants with stock, sorted by position, and axes with only the values used", () => {
    const page = buildProductPage(shirtRow(), shirtSchema(), trail);
    expect(page.variants.map((v) => [v.id, v.stock, v.price])).toEqual([
      ["v-m-black", 6, 1850],
      ["v-m-white", 2, 1850],
      ["v-l-black", 4, 1950],
      ["v-l-white", 0, 1950],
    ]);
    expect(page.variants[0].label).toBe("Size: M, Colour: Black");
    expect(page.axes).toEqual([
      { key: "size", name: "Size", options: [{ value: "m", label: "M" }, { value: "l", label: "L" }] },
      { key: "colour", name: "Colour", options: [{ value: "black", label: "Black" }, { value: "white", label: "White" }] },
    ]);
    expect(page.price).toEqual({ min: 1850, max: 1950 });
    expect(page.inStock).toBe(true);
  });

  it("orders axis options like the seller's variants and keeps values missing from the schema", () => {
    const row = shirtRow({
      variants: [
        { id: "a", price: 1, stock: 1, options: { size: "xxl", colour: "white" }, position: 0 },
        { id: "b", price: 1, stock: 1, options: { size: "s", colour: "black" }, position: 1 },
      ],
    });
    const page = buildProductPage(row, shirtSchema(), trail);
    expect(page.axes[0].options).toEqual([{ value: "xxl", label: "xxl" }, { value: "s", label: "S" }]);
    expect(page.axes[1].options.map((o) => o.label)).toEqual(["White", "Black"]);
  });

  it("is out of stock when every variant has 0 stock", () => {
    const row = shirtRow();
    const page = buildProductPage({ ...row, variants: row.variants.map((v) => ({ ...v, stock: 0 })) }, shirtSchema(), trail);
    expect(page.inStock).toBe(false);
  });

  it("computes the delivery charge from the listing weight (D9)", () => {
    const light = buildProductPage(shirtRow(), shirtSchema(), trail);
    expect(light.weightGrams).toBe(250);
    expect(light.delivery.insideDhaka.total).toBe(70);
    expect(light.delivery.outsideDhaka.total).toBe(130);
    const heavy = buildProductPage(shirtRow({ attributes: { ...(shirtRow().attributes as object), weight_g: 2300 } }), shirtSchema(), trail);
    expect(heavy.delivery.insideDhaka).toMatchObject({ extraKg: 2, total: 110 });
    expect(heavy.delivery.outsideDhaka.total).toBe(170);
  });

  it("shows return eligibility, shop info, breadcrumb and accessible image labels", () => {
    const page = buildProductPage(shirtRow(), shirtSchema(), trail);
    expect(page.returns).toMatchObject({ value: "change_of_mind", label: "Returnable, including change of mind" });
    expect(page.returns.text).toMatch(/7 days/);
    expect(page.shop).toEqual({ name: "Test Fashion Shop", slug: "test-fashion-shop", verified: true, href: "/s/test-fashion-shop" });
    expect(page.breadcrumb.map((c) => c.name)).toEqual(["Fashion", "Men", "Men's Shirts"]);
    expect(page.images).toEqual([
      { id: "img-cover", alt: "Oxford cotton shirt, image 1 of 2" },
      { id: "img-2", alt: "Oxford cotton shirt, image 2 of 2" },
    ]);
    const basic = buildProductPage(shirtRow({ shop: { id: "s2", name: "Book Shop", slug: "book", tier: "basic" }, images: [{ id: "only" }] }), shirtSchema(), trail);
    expect(basic.shop.verified).toBe(false);
    expect(basic.images).toEqual([{ id: "only", alt: "Oxford cotton shirt" }]);
  });
});

describe("createProductPageLoader", () => {
  const deps = (row: DetailRow | null) => ({
    findLiveProduct: vi.fn(async () => row),
    findCategories: vi.fn(async () => trail),
    getCategorySchema: vi.fn(async () => shirtSchema()),
    now: () => NOW,
  });

  it("asks only for live products, with Bangladesh today", async () => {
    const d = deps(shirtRow());
    const page = await createProductPageLoader(d)("p-shirt");
    expect(page?.title).toBe("Oxford cotton shirt");
    expect(d.findLiveProduct).toHaveBeenCalledWith("p-shirt", TODAY);
    expect(d.findCategories).toHaveBeenCalledWith(["cat-fashion", "cat-men", "cat-shirts"]);
  });

  it("returns null (404) when the product is not live or has no variants", async () => {
    expect(await createProductPageLoader(deps(null))("gone")).toBeNull();
    expect(await createProductPageLoader(deps(shirtRow({ variants: [] })))("p-shirt")).toBeNull();
    const d = deps(shirtRow());
    expect(await createProductPageLoader(d)("")).toBeNull();
    expect(d.findLiveProduct).not.toHaveBeenCalled();
  });

  it("still shows guideline specs when the category was archived after listing", async () => {
    const d = deps(shirtRow());
    d.getCategorySchema.mockRejectedValueOnce(new CatalogError(422, "CATEGORY_ARCHIVED", "This category is archived"));
    const page = await createProductPageLoader(d)("p-shirt");
    expect(page?.specs.map((s) => s.key)).toEqual(["quantity", "weight_g", "brand", "country_of_origin", "ingredients_materials", "warranty"]);
  });
});

describe("formatDate", () => {
  it("formats calendar dates without time zone shifts", () => {
    expect(formatDate("2027-01-01")).toBe("1 Jan 2027");
    expect(formatDate("2027-12-31")).toBe("31 Dec 2027");
    expect(formatDate("soon")).toBe("soon");
  });
});
