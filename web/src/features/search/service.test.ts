import { describe, expect, it, vi } from "vitest";
import { createEngineSelector } from "./engine";
import { searchErrorResponse, SearchError } from "./errors";
import { createPostgresEngine } from "./postgres";
import { createSearchService, facetOptions, widgetOf, type CategoryInfo, type FilterField } from "./service";
import { seedLikeDocs } from "./test-fixtures";

const categories: Record<string, CategoryInfo> = {
  processor: { id: "processor", slug: "processor", name: "Processor", path: "/electronics/components/processor/", isLeaf: true, archivedAt: null },
  components: { id: "components", slug: "components", name: "Computer Components", path: "/electronics/components/", isLeaf: false, archivedAt: null },
  fiction: { id: "fiction", slug: "fiction", name: "Fiction", path: "/books/fiction/", isLeaf: true, archivedAt: null },
  old: { id: "old", slug: "old", name: "Old", path: "/old/", isLeaf: true, archivedAt: new Date() },
};

const processorFields: FilterField[] = [
  { key: "socket", name: "Socket", type: "enum", unit: null, widget: "checkbox_list", displayOrder: 2, options: [{ value: "am5", label: "AM5" }, { value: "lga1700", label: "LGA1700" }] },
  { key: "brand", name: "Brand", type: "enum", unit: null, widget: "checkbox_list", displayOrder: 1, options: [{ value: "amd", label: "AMD" }, { value: "intel", label: "Intel" }] },
  { key: "core_count", name: "Core count", type: "number", unit: null, widget: "range_slider", displayOrder: 3, options: [] },
  { key: "integrated_graphics", name: "Integrated graphics", type: "boolean", unit: null, widget: null, displayOrder: 4, options: [] },
];

function service() {
  const engine = createEngineSelector({ meili: null, postgres: createPostgresEngine({ loadCandidates: async () => seedLikeDocs() }) });
  const getFilterFields = vi.fn(async (id: string) => (id === "processor" ? processorFields : []));
  const svc = createSearchService({
    findCategory: async (slug) => categories[slug] ?? null,
    getFilterFields,
    categoriesByIds: async (ids) => ids.map((id) => ({ id, slug: id, name: id === "processor" ? "Processor" : "Fiction" })),
    shopsBySlugs: async (slugs) => slugs.map((slug) => ({ slug, name: slug === "tech" ? "Tech Shop" : "Book Shop" })),
    engine,
  });
  return { svc, getFilterFields };
}

const params = (qs: string) => new URLSearchParams(qs);

describe("category results with dynamic filters (US-042 acceptance criteria)", () => {
  it("on Processor results the panel shows only Processor's filterable attributes plus price and shop", async () => {
    const { svc } = service();
    const res = await svc.search(params("category=processor"));
    expect(res.mode).toBe("category");
    expect(res.facets.attributes.map((f) => f.key)).toEqual(["brand", "socket", "core_count", "integrated_graphics"]);
    expect(res.facets.attributes[3].widget).toBe("toggle"); // default widget for yes/no
    expect(res.facets.price).toEqual({ min: 21500, max: 36500, selectedMin: null, selectedMax: null });
    expect(res.facets.shops).toEqual([{ value: "tech", label: "Tech Shop", count: 3, selected: false }]);
    expect(res.facets.rating).toBeNull();
    expect(res.facets.categories).toEqual([]);
    expect(res.total).toBe(3);
  });

  it("with Brand = AMD the other facets count within the AMD results and 0-result options are hidden", async () => {
    const { svc } = service();
    const res = await svc.search(params("category=processor&f.brand=amd"));
    expect(res.items.map((i) => i.id).sort()).toEqual(["r5", "r7"]);
    const [brand, socket, cores] = res.facets.attributes;
    expect(brand).toMatchObject({
      key: "brand",
      options: [
        { value: "amd", label: "AMD", count: 2, selected: true },
        { value: "intel", label: "Intel", count: 1, selected: false },
      ],
    });
    expect(socket).toMatchObject({ key: "socket", options: [{ value: "am5", label: "AM5", count: 2, selected: false }] });
    expect(cores).toMatchObject({ key: "core_count", min: 6, max: 8 });
  });

  it("keeps a selected option with 0 results so it can be unticked", async () => {
    const { svc } = service();
    const res = await svc.search(params("category=processor&f.brand=amd&f.socket=lga1700"));
    expect(res.total).toBe(0);
    const socket = res.facets.attributes.find((f) => f.key === "socket")!;
    expect(socket).toMatchObject({ options: [{ value: "am5", count: 2, selected: false }, { value: "lga1700", count: 0, selected: true }] });
  });

  it("drops URL filters that are not filterable attributes of the category", async () => {
    const { svc } = service();
    const res = await svc.search(params("category=processor&f.author=humayun&f.core_count.min=8&f.brand.min=3"));
    expect(res.params.attrs).toEqual({ core_count: { values: [], min: 8, max: null } });
    expect(res.items.map((i) => i.id).sort()).toEqual(["i5", "r7"]);
  });

  it("a search across categories shows only common filters and 'Narrow by category'", async () => {
    const { svc, getFilterFields } = service();
    const res = await svc.search(params("f.brand=amd"));
    expect(res.mode).toBe("cross");
    expect(getFilterFields).not.toHaveBeenCalled();
    expect(res.facets.attributes).toEqual([]);
    expect(res.params.attrs).toEqual({});
    expect(res.total).toBe(4); // attribute filters do not apply across categories
    expect(res.facets.categories).toEqual([
      { id: "processor", slug: "processor", name: "Processor", count: 3 },
      { id: "fiction", slug: "fiction", name: "Fiction", count: 1 },
    ]);
  });

  it("a parent category is a cross-category search within its subtree", async () => {
    const { svc } = service();
    const res = await svc.search(params("category=components"));
    expect(res.mode).toBe("cross");
    expect(res.total).toBe(3);
    expect(res.facets.categories.map((c) => c.slug)).toEqual(["processor"]);
  });

  it("returns cards linking to the product page, 24 per page", async () => {
    const { svc } = service();
    const res = await svc.search(params("q=himu"));
    expect(res.items).toEqual([
      {
        id: "himu",
        title: "Himu (paperback)",
        bengaliName: "হিমু",
        priceMin: 250,
        priceMax: 250,
        shopName: "Book Shop",
        shopSlug: "books",
        categoryName: "Fiction",
        rating: null,
        ratingCount: 0,
        imageUrl: null,
        url: "/products/himu",
      },
    ]);
    expect(res).toMatchObject({ page: 1, perPage: 24, totalPages: 1, engine: "postgres" });
  });

  it("keyword search in Bengali and Banglish (US-045)", async () => {
    const { svc } = service();
    expect((await svc.search(params(`q=${encodeURIComponent("হিমু")}`))).items.map((i) => i.id)).toEqual(["himu"]);
    expect((await svc.search(params("q=boi"))).items.map((i) => i.id)).toEqual(["himu"]);
  });

  it("hides the price filter when nothing matches and none is set", async () => {
    const { svc } = service();
    const res = await svc.search(params("q=nothing-matches-this"));
    expect(res.total).toBe(0);
    expect(res.facets.price).toBeNull();
    const withPrice = await svc.search(params("q=nothing-matches-this&price_max=100"));
    expect(withPrice.facets.price).toMatchObject({ selectedMax: 100 });
  });

  it("unknown or archived categories are a 404; malformed parameters a 400", async () => {
    const { svc } = service();
    await expect(svc.search(params("category=nope"))).rejects.toMatchObject({ status: 404, code: "CATEGORY_NOT_FOUND" });
    await expect(svc.search(params("category=old"))).rejects.toMatchObject({ status: 404 });
    await expect(svc.search(params("page=-1"))).rejects.toMatchObject({ status: 400, code: "INVALID_PARAMS" });
  });
});

describe("facet helpers", () => {
  it("defaults the widget by type", () => {
    expect(widgetOf({ type: "number", widget: null })).toBe("range_slider");
    expect(widgetOf({ type: "boolean", widget: null })).toBe("toggle");
    expect(widgetOf({ type: "enum", widget: null })).toBe("checkbox_list");
    expect(widgetOf({ type: "number", widget: "checkbox_list" })).toBe("checkbox_list");
  });

  it("caps options by count, always keeps selected ones, and shows them by label", () => {
    const counts = { a: 5, b: 1, c: 3, d: 0 };
    expect(facetOptions(counts, ["b"], (v) => v.toUpperCase(), 2).map((o) => o.value)).toEqual(["a", "b", "c"]);
    expect(facetOptions(counts, [], (v) => v, 2).map((o) => o.value)).toEqual(["a", "c"]);
    expect(facetOptions({ "16": 2, "8": 1 }, [], (v) => `${v} GB`).map((o) => o.label)).toEqual(["8 GB", "16 GB"]);
  });
});

describe("API error shape", () => {
  it("maps search errors to { error: { code, message, fields? } } and hides unexpected ones", async () => {
    const res = searchErrorResponse(new SearchError(400, "INVALID_PARAMS", "Enter a number", { price_min: "Enter a number" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: "INVALID_PARAMS", message: "Enter a number", fields: { price_min: "Enter a number" } } });
    const notFound = searchErrorResponse(new SearchError(404, "CATEGORY_NOT_FOUND", "This category does not exist"));
    expect(await notFound.json()).toEqual({ error: { code: "CATEGORY_NOT_FOUND", message: "This category does not exist" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom = searchErrorResponse(new Error("connection string with password"));
    expect(boom.status).toBe(500);
    expect(await boom.json()).toEqual({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
    log.mockRestore();
  });
});
