import { expect, test } from "@playwright/test";

// Needs the seeded database (`npm run seed`). Works with or without Meilisearch (the Postgres
// adapter answers when MEILI_URL is unset or unreachable).
// US-041: keyword search from the header. US-042: Processor filters, Brand facet counts within
// the results, the URL keeps the filter state. US-040: empty categories stay hidden.

test("search a processor by keyword, filter by Brand, and the URL keeps the state", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("search", { name: "Site search" });
  await header.getByRole("searchbox", { name: "Search products" }).fill("ryzen processor");
  await header.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/\/search\?q=ryzen\+processor/);

  const results = page.getByRole("list", { name: "Products" });
  await expect(results.getByRole("link", { name: /AMD Ryzen 5 7600 Processor/ })).toBeVisible();
  await expect(results.getByText("Tk 24,500")).toBeVisible();
  // Results span one leaf here, but there is no category in the URL: common filters only.
  const filters = page.getByRole("complementary", { name: "Filters" });
  await expect(filters.getByRole("heading", { name: "Narrow by category" })).toBeVisible();
  await expect(filters.getByRole("group", { name: "Brand" })).toHaveCount(0);

  // Narrow to Processor: its filterable attributes appear with counts.
  await filters.getByRole("link", { name: "Processor" }).click();
  await page.waitForURL(/category=processor/);
  await expect(filters.getByRole("group", { name: "Brand" })).toBeVisible();
  await expect(filters.getByRole("group", { name: "Socket" })).toBeVisible();
  await expect(filters.getByRole("group", { name: "Price (Tk)" })).toBeVisible();
  await expect(filters.getByRole("group", { name: "Author" })).toHaveCount(0);

  // Search "processor" in the category and filter Brand = Intel.
  await page.goto("/search?q=processor&category=processor");
  const brand = filters.getByRole("group", { name: "Brand" });
  await expect(brand.getByRole("checkbox", { name: /^AMD \(\d+\)$/ })).toBeVisible();
  await brand.getByRole("checkbox", { name: /^Intel \(\d+\)$/ }).check();
  await page.waitForURL(/f\.brand=intel/);
  await expect(results.getByRole("link", { name: /Intel Core i5-14400F/ })).toBeVisible();
  await expect(results.getByRole("link", { name: /AMD Ryzen/ })).toHaveCount(0);
  // The out-of-stock i3 is never shown.
  await expect(results.getByRole("link", { name: /i3-12100/ })).toHaveCount(0);
  // Other facets count within the Intel results: AM5 has none, so it is hidden.
  const socket = filters.getByRole("group", { name: "Socket" });
  await expect(socket.getByRole("checkbox", { name: /^LGA1700 \(1\)$/ })).toBeVisible();
  await expect(socket.getByRole("checkbox", { name: /^AM5/ })).toHaveCount(0);

  // Reloading (or sharing) the URL shows the same results and filter state.
  const url = page.url();
  const other = await page.context().newPage();
  await other.goto(url);
  const otherFilters = other.getByRole("complementary", { name: "Filters" });
  await expect(otherFilters.getByRole("group", { name: "Brand" }).getByRole("checkbox", { name: /^Intel/ })).toBeChecked();
  await expect(other.getByRole("list", { name: "Products" }).getByRole("link", { name: /Intel Core i5-14400F/ })).toBeVisible();
  await expect(other.getByRole("list", { name: "Products" }).getByRole("link", { name: /AMD Ryzen/ })).toHaveCount(0);

  // Unticking the brand brings the AMD processors back.
  await brand.getByRole("checkbox", { name: /^Intel/ }).uncheck();
  await expect(page).not.toHaveURL(/f\.brand=intel/);
  await expect(results.getByRole("link", { name: /AMD Ryzen 5 7600 Processor/ })).toBeVisible();
});

test("Banglish and Bengali spellings find products (US-045)", async ({ page }) => {
  await page.goto("/search?q=boi");
  await expect(page.getByRole("list", { name: "Products" }).getByRole("link", { name: /Himu/ })).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent("শার্ট")}`);
  await expect(page.getByRole("list", { name: "Products" }).getByRole("link", { name: /Oxford cotton shirt/ })).toBeVisible();
});

test("category navigation shows only categories with products", async ({ page }) => {
  await page.goto("/categories");
  const nav = page.getByRole("navigation", { name: "Categories" });
  await expect(nav.getByRole("link", { name: "Processor" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Computer Components" })).toBeVisible();
  // Seeded without products (US-040, D11): hidden.
  await expect(nav.getByRole("link", { name: "Motherboard" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Women's Tops" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Children's" })).toHaveCount(0);

  // A parent category: common filters and its populated subcategories.
  await nav.getByRole("link", { name: "Computer Components" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Computer Components" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subcategories" }).getByRole("link", { name: /Processor/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subcategories" }).getByRole("link", { name: /Motherboard/ })).toHaveCount(0);

  // An empty category page does not exist for shoppers.
  await page.goto("/c/motherboard");
  await expect(page.getByText(/could not be found/i)).toBeVisible();

  const api = await page.request.get("/api/categories?visible=true");
  expect(api.ok()).toBeTruthy();
  const body = JSON.stringify(await api.json());
  expect(body).toContain('"slug":"processor"');
  expect(body).not.toContain('"slug":"motherboard"');
});

test("GET /api/search returns items and facets, errors in the standard shape", async ({ request }) => {
  const res = await request.get("/api/search?q=processor&category=processor&f.brand=amd");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.items.some((i: { title: string }) => /Intel/.test(i.title))).toBe(false);
  const brand = body.facets.attributes.find((f: { key: string }) => f.key === "brand");
  expect(brand.options.find((o: { value: string }) => o.value === "amd")).toMatchObject({ selected: true, count: body.total });

  const bad = await request.get("/api/search?sort=cheapest");
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatchObject({ code: "INVALID_PARAMS", fields: { sort: expect.any(String) } });
  expect((await request.get("/api/search?category=no-such-category")).status()).toBe(404);
});
