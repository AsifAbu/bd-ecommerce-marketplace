import "dotenv/config";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

// US-050, US-056, US-058: a guest fills a cart from two shops, sees it grouped with a delivery
// charge per shop, hits the stock cap, saves an item for later, then logs in and the guest cart
// merges into the account cart. Needs seed data (`npm run seed`): the Test Tech Shop has free
// delivery from Tk 10,000; "[TEST] Engineering Mathematics" has 8 in stock.
const HIMU = "[TEST] Himu (paperback)";
const MATHS = "[TEST] Engineering Mathematics";
const RAM = "[TEST] Corsair Vengeance 16GB DDR5 RAM";
const BOOK_SHOP = "[TEST] Test Book Shop";
const TECH_SHOP = "[TEST] Test Tech Shop";
const SHOPPER = "cart.e2e@ecom.test";

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" }); // the tests share one shopper's cart

const ids: Record<string, string> = {};

test.beforeAll(async () => {
  for (const title of [HIMU, MATHS, RAM]) {
    const [row] = await query<{ id: string }>("SELECT id FROM product WHERE title = $1 AND deleted_at IS NULL", [title]);
    ids[title] = row.id;
  }
  // A shopper of our own (same test password as the seed users), with Himu already in the cart.
  await query(
    `INSERT INTO "user" (id, email, name, password_hash, email_verified_at, created_at, updated_at)
     SELECT 'e2e-cart-shopper', $1, '[TEST] Cart shopper', password_hash, now(), now(), now()
     FROM "user" WHERE email = 'customer.verified@ecom.test'
     ON CONFLICT (email) DO NOTHING`,
    [SHOPPER],
  );
  await query(`DELETE FROM cart_item WHERE user_id = 'e2e-cart-shopper'`);
  await query(
    `INSERT INTO cart_item (id, user_id, product_id, variant_id, shop_id, quantity, saved_for_later, price_at_add, created_at, updated_at)
     SELECT 'e2e-cart-himu', 'e2e-cart-shopper', p.id, v.id, p.shop_id, 1, false, v.price, now(), now()
     FROM product p JOIN product_variant v ON v.product_id = p.id WHERE p.id = $1`,
    [ids[HIMU]],
  );
});

const shopSection = (page: Page, shop: string): Locator => page.getByRole("region", { name: shop });
const cartLink = (page: Page) => page.getByRole("navigation", { name: "Your links" }).getByRole("link", { name: /^Cart/ });

async function addToCart(page: Page, title: string, quantity?: number) {
  await page.goto(`/products/${ids[title]}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  if (quantity !== undefined) await page.getByLabel("Quantity").fill(String(quantity));
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: "View cart" })).toBeVisible();
}

test("guest cart from two shops: grouped with delivery per shop, stock cap, save for later, merged at login", async ({ page }) => {
  // Guest adds from two shops; the quantity above the stock is capped with a message.
  await addToCart(page, HIMU);
  await expect(cartLink(page)).toHaveText("Cart (1 item)");
  await addToCart(page, MATHS, 20);
  await expect(page.getByText("Only 8 in stock. Quantity set to 8. Added to your cart.")).toBeVisible();
  await addToCart(page, RAM);
  await expect(cartLink(page)).toHaveText("Cart (10 items)");

  // Grouped by shop, each with its subtotal and delivery charge (D9: 9 × 250 g = 2.25 kg).
  await cartLink(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
  const books = shopSection(page, BOOK_SHOP);
  const tech = shopSection(page, TECH_SHOP);
  await expect(books.getByRole("listitem")).toHaveCount(2);
  await expect(books).toContainText("Subtotal (9 items)Tk 5,450");
  await expect(books).toContainText("Tk 110 (2.25 kg: Tk 70 + 2 extra kg × Tk 20)");
  await expect(books).toContainText("Shop totalTk 5,560");
  await expect(tech).toContainText("Subtotal (1 item)Tk 6,800");
  await expect(tech).toContainText("Tk 70 (up to 1 kg)");
  await expect(tech).toContainText("Add Tk 3,200 more from this shop for free delivery");
  const summary = page.getByRole("region", { name: "Order summary" });
  await expect(summary).toContainText("Delivery (2 shops, Inside Dhaka)Tk 180");
  await expect(summary).toContainText("TotalTk 12,430");

  // Quantity above the stock in the cart: capped at 8 with a message.
  const qty = page.getByRole("spinbutton", { name: `Quantity of ${MATHS}` });
  await qty.fill("20");
  await qty.press("Enter");
  await expect(page.getByText("Only 8 in stock. Quantity set to 8.").first()).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: `Quantity of ${MATHS}` })).toHaveValue("8");

  // Keyboard: the + stepper reaches the free-delivery threshold for the tech shop.
  await page.getByRole("button", { name: `Increase quantity of ${RAM}` }).focus();
  await page.keyboard.press("Enter");
  await expect(tech).toContainText("Free delivery");
  await expect(tech).toContainText("Shop totalTk 13,600");

  // Outside Dhaka: Tk 130 + 2 extra kg for the book shop; the tech shop stays free.
  await page.getByRole("radio", { name: "Outside Dhaka" }).check();
  await expect(books).toContainText("Tk 170 (2.25 kg: Tk 130 + 2 extra kg × Tk 20)");
  await expect(summary).toContainText("Delivery (2 shops, Outside Dhaka)Tk 170");

  // Save for later: out of the totals into the saved list.
  await page.getByRole("button", { name: `Save for later: ${HIMU}` }).click();
  const saved = page.getByRole("region", { name: /Saved for later/ });
  await expect(saved).toContainText(HIMU);
  await expect(books).toContainText("Subtotal (8 items)Tk 5,200");
  await expect(cartLink(page)).toHaveText("Cart (10 items)");

  // Log in: the guest cart merges into the account cart (Himu: 1 in the account cart + 1 saved
  // on the device -> 2 in the cart).
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/cart")}`);
  await page.getByLabel("Mobile number or email").fill(SHOPPER);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: `Quantity of ${HIMU}` })).toHaveValue("2");
  await expect(page.getByRole("spinbutton", { name: `Quantity of ${MATHS}` })).toHaveValue("8");
  await expect(page.getByRole("spinbutton", { name: `Quantity of ${RAM}` })).toHaveValue("2");
  await expect(page.getByRole("region", { name: /Saved for later/ })).toHaveCount(0);
  await expect(cartLink(page)).toHaveText("Cart (12 items)");

  const rows = await query<{ n: string }>(`SELECT count(*)::text AS n FROM cart_item WHERE user_id = 'e2e-cart-shopper'`);
  expect(rows[0].n).toBe("3");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "cart_guest")).toBeUndefined();

  // No price changes: Checkout continues (US-051; this shopper has no mobile yet, so checkout asks for one).
  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
  await expect(page.getByText("Cash on delivery needs a verified mobile number.")).toBeVisible();
});

test("a changed price shows a notice and Checkout waits until it is accepted", async ({ page }) => {
  await query(`DELETE FROM cart_item WHERE user_id = 'e2e-cart-shopper'`);
  await query(
    `INSERT INTO cart_item (id, user_id, product_id, variant_id, shop_id, quantity, saved_for_later, price_at_add, created_at, updated_at)
     SELECT 'e2e-cart-maths', 'e2e-cart-shopper', p.id, v.id, p.shop_id, 1, false, v.price - 50, now(), now()
     FROM product p JOIN product_variant v ON v.product_id = p.id WHERE p.id = $1`,
    [ids[MATHS]],
  );
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/cart")}`);
  await page.getByLabel("Mobile number or email").fill(SHOPPER);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("The price went up from Tk 600 to Tk 650 since you added it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(page.getByText("The price of 1 item changed. Accept the new price to continue.")).toBeVisible();
  await page.getByRole("button", { name: `Accept new price: ${MATHS}` }).click();
  await expect(page.getByRole("link", { name: "Checkout" })).toBeVisible();
  await expect(page.getByText("The price went up")).toHaveCount(0);
});
