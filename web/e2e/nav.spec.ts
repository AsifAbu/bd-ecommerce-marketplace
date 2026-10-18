import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Header account menu: Log in / Sign up for guests, the user's name with a dropdown when logged in,
// and the admin pages (shop approval first) reachable from that menu.

async function sql<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

async function login(page: Page, identifier: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const header = (page: Page) => page.getByRole("banner");
// The header has two dropdowns (categories and account); this picks the account one.
const accountMenu = (page: Page) => header(page).locator("details").filter({ has: page.getByLabel(/Account menu for/) });

test("a guest sees Log in and Sign up in the header", async ({ page }) => {
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(header(page).getByRole("link", { name: "Sign up" })).toBeVisible();
  await header(page).getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("a logged-in customer sees their name in the header and can open their profile from it", async ({ page }) => {
  await login(page, "customer.verified@ecom.test");
  await page.goto("/");
  await expect(header(page).getByRole("link", { name: "Log in" })).toHaveCount(0);
  const menu = accountMenu(page);
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: "My profile" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "My orders" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Open a shop" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Approve shops" })).toHaveCount(0);
  await menu.getByRole("link", { name: "My profile" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("a shop owner finds their shop in the menu", async ({ page }) => {
  await login(page, "owner.tech@ecom.test");
  await page.goto("/");
  const menu = accountMenu(page);
  await menu.locator("summary").click();
  await menu.getByRole("link", { name: /Test Tech Shop/ }).click();
  await expect(page).toHaveURL(/\/seller\/[^/]+$/);
});

test("the admin approves a newly applied shop from the header menu", async ({ page }) => {
  const stamp = Date.now();
  const name = `[TEST] Nav Shop ${stamp}`;
  const [owner] = await sql<{ id: string }>(`SELECT id FROM "user" WHERE email = 'customer.new@ecom.test'`);
  const id = `e2e-nav-${stamp}`;
  await sql(
    `INSERT INTO shop (id, name, slug, type, status, owner_id, owner_nid, owner_photo_key, created_at, updated_at)
     VALUES ($1, $2, $3, 'general', 'pending', $4, '1234567890', 'seed/dummy-document.txt', now(), now())`,
    [id, name, `e2e-nav-${stamp}`, owner.id],
  );
  await sql(`INSERT INTO shop_member (id, shop_id, user_id, role, created_at) VALUES ($1, $2, $3, 'owner', now())`, [id, id, owner.id]);

  await login(page, "admin@ecom.test");
  await page.goto("/");
  const menu = accountMenu(page);
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: /Approve shops/ })).toContainText("waiting");
  await menu.getByRole("link", { name: /Approve shops/ }).click();
  await expect(page).toHaveURL(/\/admin\/shops/);
  const application = page.getByRole("article").filter({ hasText: name });
  await application.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("article").filter({ hasText: name }).getByRole("button", { name: "Suspend" })).toBeVisible();
  const [row] = await sql<{ status: string }>(`SELECT status FROM shop WHERE id = $1`, [id]);
  expect(row.status).toBe("approved");
});
