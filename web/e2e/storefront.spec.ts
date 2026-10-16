import { expect, test, type Page } from "@playwright/test";

// Needs the seeded database (`npm run seed`). MinIO is not needed: seeded products have no images.
// US-014: a guest browses one shop's storefront; suspended and unknown shops are "not found";
// the owner finds the shareable link on the seller dashboard.

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel(/mobile.*email/i).fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

test("a guest browses a shop's storefront and sees only its products", async ({ page }) => {
  await page.goto("/s/test-tech-shop");
  await expect(page.getByRole("heading", { level: 1, name: "[TEST] Test Tech Shop" })).toBeVisible();
  await expect(page.getByText("Verified seller")).toBeVisible();
  await expect(page.getByText(/^Member since /)).toBeVisible();

  const grid = page.getByRole("region", { name: /^Products/ });
  const cpu = grid.getByRole("link", { name: /\[TEST\] AMD Ryzen 5 7600 Processor/ });
  await expect(cpu).toBeVisible();
  await expect(cpu).toContainText("Tk 24,500");
  await expect(cpu).toHaveAttribute("href", /^\/products\/[^/]+$/);
  await expect(grid.getByRole("link", { name: /\[TEST\] Corsair Vengeance 16GB DDR5 RAM/ })).toBeVisible();
  // Other shops' products never show.
  for (const other of ["Himu", "Oxford cotton shirt", "Paracetamol", "Hidden: suspended shop"]) {
    await expect(page.getByText(other)).toHaveCount(0);
  }

  // Filter by one of the shop's categories.
  await page.getByLabel("Category").selectOption("ram");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/category=ram/);
  await expect(grid.getByRole("link", { name: /Corsair Vengeance/ })).toBeVisible();
  await expect(grid.getByRole("link", { name: /AMD Ryzen 5 7600/ })).toHaveCount(0);

  // Facebook preview tags.
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "[TEST] Test Tech Shop");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", /\/s\/test-tech-shop$/);
});

test("suspended and unknown shops are not found", async ({ page }) => {
  for (const slug of ["test-suspended-shop", "no-such-shop-e2e"]) {
    await page.goto(`/s/${slug}`);
    await expect(page.getByRole("heading", { name: "Shop not found" })).toBeVisible();
    await expect(page.getByText("Hidden: suspended shop")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  }
});

test("the owner sees the storefront link with copy and Facebook share on the dashboard", async ({ page }) => {
  await login(page, "owner.tech@ecom.test", "/seller");
  await page.getByRole("link", { name: /Test Tech Shop/ }).click();
  await page.waitForURL(/\/seller\/[^/]+$/);

  const share = page.getByRole("region", { name: "Storefront link" });
  const link = share.getByRole("link", { name: /\/s\/test-tech-shop$/ });
  await expect(link).toBeVisible();
  const url = await link.getAttribute("href");
  expect(url).toMatch(/^https?:\/\/[^/]+\/s\/test-tech-shop$/);
  await expect(share.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect(share.getByRole("link", { name: "Share on Facebook" })).toHaveAttribute(
    "href",
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url!)}`,
  );

  await page.getByRole("link", { name: "View storefront" }).click();
  await page.waitForURL("**/s/test-tech-shop");
  await expect(page.getByRole("heading", { level: 1, name: "[TEST] Test Tech Shop" })).toBeVisible();
});
