import { expect, test } from "@playwright/test";

// Needs the seeded database (`npm run seed`) and APP_MODE=test. Works without MinIO and Meilisearch:
// seeded products have no pictures, so the home page shows coloured placeholders.

test("home page looks like a store: category tiles, new arrivals, rows, shops, sell call to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Marketplace");
  await expect(page.getByRole("search", { name: "Search the marketplace" })).toBeVisible();

  const tiles = page.getByRole("list", { name: "Category tiles" });
  await expect(tiles.getByRole("link", { name: /Electronics/ })).toContainText(/\d+ products?/);
  await expect(tiles.getByRole("link", { name: /Books/ })).toBeVisible();

  const arrivals = page.getByRole("list", { name: "New arrivals" });
  await expect(arrivals.getByRole("link").first()).toContainText("[TEST]");
  await expect(arrivals.getByTestId("product-placeholder").first()).toBeVisible();
  await expect(page.getByText("Hidden: suspended shop's processor")).toHaveCount(0);

  await expect(page.getByRole("link", { name: "See all in Electronics" })).toHaveAttribute("href", "/c/electronics");
  await expect(page.getByRole("list", { name: "Featured shops" }).getByRole("link", { name: /Test Tech Shop/ })).toHaveAttribute("href", "/s/test-tech-shop");
  await expect(page.getByRole("list", { name: "Featured shops" }).getByText("Suspended Shop")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open your shop" })).toHaveAttribute("href", "/shops/apply");
});

test("test mode shows the demo logins", async ({ page }) => {
  await page.goto("/");
  const hint = page.getByTestId("demo-hint");
  await expect(hint).toContainText("Try the demo");
  for (const email of ["admin@ecom.test", "customer.verified@ecom.test", "owner.tech@ecom.test", "staff.tech@ecom.test"]) {
    await expect(hint).toContainText(email);
  }
  await expect(hint).toContainText("Test@12345");
});

test("clicking a product on the home page opens its page", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("list", { name: "New arrivals" }).getByRole("link").first();
  const title = (await first.getByRole("heading", { level: 3 }).textContent())!;
  await first.click();
  await page.waitForURL(/\/products\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
});

test("header category menu lists top categories and opens a category page", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Shop menu" });
  await menu.getByText("Browse categories").click();
  await expect(menu.getByRole("link", { name: /Electronics/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: "All categories" })).toHaveAttribute("href", "/categories");
  await menu.getByRole("link", { name: /Electronics/ }).click();
  await page.waitForURL(/\/c\/electronics/);
  await expect(page.getByRole("heading", { level: 1, name: "Electronics" })).toBeVisible();
});

test("hero search goes to the results page", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("search", { name: "Search the marketplace" });
  await hero.getByRole("searchbox").fill("himu");
  await hero.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/\/search\?q=himu/);
  await expect(page.getByRole("list", { name: "Products" }).getByRole("link", { name: /Himu/ })).toBeVisible();
});
