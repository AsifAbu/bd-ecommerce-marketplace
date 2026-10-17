import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// US-044 product page and US-057 wishlist. Needs seed data (`npm run seed`): the
// "[TEST] Oxford cotton shirt" of the Test Fashion Shop (Verified) with L / White sold out.
const SHIRT = "[TEST] Oxford cotton shirt";
const CUSTOMER = "customer.flagged@ecom.test";

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" }); // the tests share one customer's wishlist

let productId: string;

test.beforeAll(async () => {
  const [row] = await query<{ id: string }>("SELECT id FROM product WHERE title = $1 AND deleted_at IS NULL", [SHIRT]);
  productId = row.id;
});

test.beforeEach(async () => {
  // Start from an empty wishlist for this product.
  await query(
    `DELETE FROM wishlist_item WHERE product_id = $1 AND user_id = (SELECT id FROM "user" WHERE email = $2)`,
    [productId, CUSTOMER],
  );
});

async function fillLogin(page: Page, identifier: string, password = "Test@12345") {
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("product page: specs, delivery, variants; guest wishlist saved after login, then removed", async ({ page }) => {
  await page.goto(`/products/${productId}`);
  await expect(page.getByRole("heading", { level: 1, name: SHIRT })).toBeVisible();
  await expect(page).toHaveTitle(SHIRT);
  await expect(page.getByRole("link", { name: "Test Fashion Shop" }).first()).toHaveAttribute("href", "/s/test-fashion-shop");
  await expect(page.getByText("Verified seller").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Men's Shirts");
  await expect(page.getByRole("img", { name: /no image available/ })).toBeVisible();

  // Specs (guideline fields included), delivery charge (D9) and returns.
  const specs = page.getByRole("table");
  await expect(specs.getByRole("row", { name: /Country of origin/ })).toContainText("Bangladesh");
  await expect(specs.getByRole("row", { name: /Weight/ })).toContainText("250 g");
  await expect(page.getByText("Tk 70 (up to 1 kg)")).toBeVisible();
  await expect(page.getByText("Tk 130 (up to 1 kg)")).toBeVisible();
  await expect(page.getByText("Returnable.", { exact: false })).toBeVisible();

  // Variant picker: price range until chosen; L is disabled once White is chosen (sold out).
  await expect(page.getByText("Tk 1,850 – Tk 1,950")).toBeVisible();
  await expect(page.getByText("Choose size and colour to see stock")).toBeVisible();
  await page.getByRole("radio", { name: "White", exact: true }).check();
  await expect(page.getByRole("radio", { name: /^L/ })).toBeDisabled();
  await page.getByRole("radio", { name: "Black", exact: true }).check();
  await page.getByRole("radio", { name: /^L/ }).check();
  await expect(page.getByText("Tk 1,950")).toBeVisible();
  await page.getByRole("radio", { name: /^M/ }).check();
  await expect(page.getByText("Tk 1,850")).toBeVisible();
  await expect(page.getByText("In stock: 6 available")).toBeVisible();
  await expect(page).toHaveURL(/variant=/);
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();

  // Guest taps the heart: asked to log in, then the item is saved and the intent cleared.
  await page.getByRole("button", { name: "Save to wishlist" }).click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await fillLogin(page, CUSTOMER);
  await expect(page.getByText("Saved to your wishlist.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();
  await expect(page).not.toHaveURL(/wishlist=add/);
  await expect(page.getByText("In stock: 6 available")).toBeVisible(); // the chosen variant is kept

  // The wishlist lists it with the variant, price and stock; it can be moved to the cart.
  await page.getByRole("navigation", { name: "Your links" }).getByRole("link", { name: "Wishlist" }).click();
  await expect(page.getByRole("heading", { name: "My wishlist" })).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: SHIRT });
  await expect(item).toContainText("Size: M, Colour: Black");
  await expect(item).toContainText("Tk 1,850");
  await expect(item).toContainText("In stock");
  await expect(item.getByRole("button", { name: "Move to cart" })).toBeEnabled();

  await item.getByRole("button", { name: `Remove ${SHIRT} from wishlist` }).click();
  await expect(page.getByRole("listitem").filter({ hasText: SHIRT })).toHaveCount(0);
});

test("logged-in customer saves and unsaves from the product page", async ({ page }) => {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(`/products/${productId}`)}`);
  await fillLogin(page, CUSTOMER);
  await expect(page.getByRole("heading", { level: 1, name: SHIRT })).toBeVisible();
  await page.getByRole("button", { name: "Save to wishlist" }).click(); // no variant chosen yet
  await expect(page.getByText("Saved to your wishlist.")).toBeVisible();
  await page.getByRole("button", { name: "Remove from wishlist" }).click();
  await expect(page.getByText("Removed from your wishlist.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to wishlist" })).toBeVisible();
});

test("unknown or hidden products are not shown", async ({ page }) => {
  await page.goto("/products/does-not-exist");
  await expect(page.getByRole("heading", { name: "Product not available" })).toBeVisible();
});

test("the wishlist page asks guests to log in", async ({ page }) => {
  await page.goto("/account/wishlist");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount%2Fwishlist/);
});
