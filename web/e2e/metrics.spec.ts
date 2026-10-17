import { expect, test, type Page } from "@playwright/test";

// Needs the seeded database (`npm run seed`). US-083 marketplace metrics (admin only) and
// US-059 seller performance score on the storefront.

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel(/mobile.*email/i).fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

test("the admin sees the KPI tiles, the 30-day window and can switch it", async ({ page }) => {
  await login(page, "admin@ecom.test", "/admin/metrics");
  await expect(page.getByRole("heading", { level: 1, name: "Marketplace metrics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key figures, last 30 days" })).toBeVisible();
  const tiles = page.locator("[data-testid^='tile-']").locator("visible=true");
  await expect(tiles.first()).toBeVisible();
  expect(await tiles.count()).toBeGreaterThanOrEqual(12);
  await expect(page.getByTestId("tile-gmv").locator("visible=true")).toContainText("Tk");
  await expect(page.getByTestId("tile-active-shops").locator("visible=true")).toContainText(/Target (met|not met)|No data/);
  await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByRole("img", { name: /GMV per day, 30 days/ })).toBeVisible();

  await page.getByRole("link", { name: "7 days" }).click();
  await page.waitForURL(/days=7/);
  await expect(page.getByRole("heading", { name: "Key figures, last 7 days" })).toBeVisible();

  // JSON API with the same session.
  const res = await page.request.get("/api/admin/metrics?days=90");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.days).toBe(90);
  expect(body.tiles.length).toBeGreaterThanOrEqual(12);
});

test("guests go to login and a customer is refused", async ({ page, browser }) => {
  await page.goto("/admin/metrics");
  await expect(page).toHaveURL(/\/login|\/api\/auth\/signin/);

  const guestApi = await page.request.get("/api/admin/metrics");
  expect(guestApi.status()).toBe(401);
  expect((await guestApi.json()).error.code).toBe("UNAUTHORIZED");

  const ctx = await browser.newContext();
  const customer = await ctx.newPage();
  await login(customer, "customer.verified@ecom.test", "/account");
  // The page streams inside Suspense, so the status is already 200: the body is the not-found page.
  await customer.goto("/admin/metrics");
  await expect(customer.getByText(/could not be found|404/i).locator("visible=true").first()).toBeVisible();
  await expect(customer.getByText("Key figures")).toHaveCount(0);
  const api = await customer.request.get("/api/admin/metrics");
  expect(api.status()).toBe(403);
  expect((await api.json()).error.code).toBe("FORBIDDEN");
  await ctx.close();
});

test("a storefront shows the seller score or New seller", async ({ page }) => {
  await page.goto("/s/test-tech-shop");
  await expect(page.getByRole("heading", { level: 1, name: "[TEST] Test Tech Shop" })).toBeVisible();
  await expect(page.getByTestId("seller-score").locator("visible=true")).toHaveText(/Seller score \d+\/100 · (Excellent|Good|Fair|Needs work)|New seller/);
});
