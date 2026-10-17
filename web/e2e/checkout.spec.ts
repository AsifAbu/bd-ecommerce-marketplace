import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// US-051, US-052, US-007, US-008 and D8: cash-on-delivery checkout. A logged-in customer orders
// a two-shop cart (two shop orders on the confirmation and in My orders), a guest orders with
// OTP 123456 and tracks the order with its number + OTP, and the flagged customer (2 refused
// deliveries in the seed) is blocked from COD. Needs seed data (`npm run seed`).
const HIMU = "[TEST] Himu (paperback)";
const RAM = "[TEST] Corsair Vengeance 16GB DDR5 RAM";
const PARA = "[TEST] Paracetamol 500 mg tablets";
const BOOK_SHOP = "[TEST] Test Book Shop";
const TECH_SHOP = "[TEST] Test Tech Shop";
const SHOPPER = "checkout.e2e@ecom.test";
const SHOPPER_PHONE = "+8801710000201";

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const ids: Record<string, string> = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  for (const title of [HIMU, RAM, PARA]) {
    const [row] = await query<{ id: string }>("SELECT id FROM product WHERE title = $1 AND deleted_at IS NULL", [title]);
    ids[title] = row.id;
  }
  // Our own customer: verified phone, a saved address outside Dhaka (same password as the seed users).
  await query(
    `INSERT INTO "user" (id, email, phone, phone_verified_at, name, password_hash, email_verified_at, created_at, updated_at)
     SELECT 'e2e-checkout-shopper', $1, $2, now(), '[TEST] Checkout shopper', password_hash, now(), now(), now()
     FROM "user" WHERE email = 'customer.verified@ecom.test'
     ON CONFLICT (email) DO NOTHING`,
    [SHOPPER, SHOPPER_PHONE],
  );
  await query(
    `INSERT INTO address (id, user_id, name, phone, division, district, upazila, area, line1, is_default, created_at, updated_at)
     VALUES ('e2e-checkout-address', 'e2e-checkout-shopper', '[TEST] Checkout shopper', $1, 'Chattogram', 'Chattogram', 'Panchlaish', 'GEC Circle', 'House 7', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [SHOPPER_PHONE],
  );
  // Earlier runs' orders are closed as delivered (orders are never deleted), so the open-order
  // limits (D8, D14) don't build up, and the stock is set back to the seed values.
  await query(
    `UPDATE shop_order SET status = 'delivered', delivered_at = now()
     WHERE status IN ('placed', 'confirmed', 'packed', 'handed_over')
       AND order_id IN (SELECT id FROM "order" WHERE contact_email IN ($1, 'guest.e2e@ecom.test'))`,
    [SHOPPER],
  );
  await query(`UPDATE product_variant SET stock = 40 WHERE product_id = $1`, [ids[HIMU]]);
  await query(`UPDATE product_variant SET stock = 25 WHERE product_id = $1`, [ids[RAM]]);
  // A two-shop cart: 1 RAM (tech shop) and 2 Himu (book shop).
  await query(`DELETE FROM cart_item WHERE user_id = 'e2e-checkout-shopper'`);
  for (const [title, qty] of [
    [RAM, 1],
    [HIMU, 2],
  ] as const) {
    await query(
      `INSERT INTO cart_item (id, user_id, product_id, variant_id, shop_id, quantity, saved_for_later, price_at_add, created_at, updated_at)
       SELECT 'e2e-checkout-' || p.id, 'e2e-checkout-shopper', p.id, v.id, p.shop_id, $2, false, v.price, now(), now()
       FROM product p JOIN product_variant v ON v.product_id = p.id WHERE p.id = $1`,
      [ids[title], qty],
    );
  }
});

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
}

const orderNoFrom = (url: string) => url.match(/\/orders\/(BD-\d{6}-[A-Z0-9]{5})/)![1];

test("logged-in customer checks out a two-shop cart with COD: two shop orders, outside-Dhaka charges, My orders, invoice", async ({ page }) => {
  await login(page, SHOPPER, "/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();

  // The default address is outside Dhaka: each shop order shows Tk 130 and its total.
  await expect(page.getByRole("radio", { name: /House 7, GEC Circle, Panchlaish, Chattogram/ })).toBeChecked();
  const tech = page.getByRole("region", { name: `Shop order 1: ${TECH_SHOP}` });
  const books = page.getByRole("region", { name: `Shop order 2: ${BOOK_SHOP}` });
  await expect(tech).toContainText("Delivery chargeTk 130 (up to 1 kg)");
  await expect(tech).toContainText("Shop order totalTk 6,930");
  await expect(books).toContainText("2 × " + HIMU);
  await expect(books).toContainText("Shop order totalTk 630");
  const total = page.getByLabel("Checkout total");
  await expect(total).toContainText("Delivery charges (2 shops)Tk 260");
  await expect(total).toContainText("Total to pay on deliveryTk 7,560");

  // The policies must be accepted before the order is placed.
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await page.getByRole("button", { name: "Place order (cash on delivery)" }).click();

  await expect(page).toHaveURL(/\/orders\/BD-\d{6}-[A-Z0-9]{5}\?placed=1$/);
  const orderNo = orderNoFrom(page.url());
  await expect(page.getByRole("heading", { level: 1, name: `Order ${orderNo}` })).toBeVisible();
  await expect(page.getByText(`Thank you! Your order ${orderNo} is placed.`)).toBeVisible();
  await expect(page.getByRole("region", { name: new RegExp(`^Shop order ${orderNo}-\\d: `) })).toHaveCount(2);
  await expect(page.getByTestId("shop-order-status").first()).toHaveText("Placed, waiting for the shop");
  await expect(page.getByLabel("Order total")).toContainText("Total (cash on delivery)Tk 7,560");

  // My orders lists it with both shop orders.
  await page.getByRole("navigation", { name: "Your links" }).getByRole("link", { name: "My orders" }).click();
  const entry = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: orderNo }) });
  await expect(entry).toContainText(`${TECH_SHOP}: Placed, waiting for the shop`);
  await expect(entry).toContainText(`${BOOK_SHOP}: Placed, waiting for the shop`);

  // The printable invoice of one shop order: seller, VAT line, warranty, delivery charge, COD.
  await entry.getByRole("link", { name: orderNo }).click();
  await page.getByRole("region", { name: `Shop order ${orderNo}-1: ${TECH_SHOP}` }).getByRole("link", { name: "Print invoice" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
  await expect(page.getByText("Trade licence TEST-TL-0001")).toBeVisible();
  const invoice = page.getByLabel("Invoice total");
  await expect(invoice).toContainText("VAT (0%, included in prices)Tk 0");
  await expect(invoice).toContainText("Delivery chargeTk 130");
  await expect(invoice).toContainText("TotalTk 6,930");
  await expect(page.getByRole("cell", { name: "Lifetime" })).toBeVisible();

  // The cart is empty and the stock went down.
  const left = await query<{ n: string }>(`SELECT count(*)::text AS n FROM cart_item WHERE user_id = 'e2e-checkout-shopper'`);
  expect(left[0].n).toBe("0");
  const [himu] = await query<{ stock: number }>(`SELECT stock FROM product_variant WHERE product_id = $1`, [ids[HIMU]]);
  expect(himu.stock).toBe(38);
});

test("guest checks out with OTP 123456, tracks the order with its number + OTP, and finds it after signing up with that mobile", async ({ page, browser }) => {
  const mobile = `017${String(Date.now()).slice(-8)}`;
  await page.goto(`/products/${ids[HIMU]}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: "View cart" })).toBeVisible();
  await page.goto("/checkout");

  const details = page.getByRole("group", { name: "Your details" });
  await details.getByLabel("Full name").fill("[TEST] E2E guest");
  await details.getByLabel("Mobile number", { exact: true }).fill(mobile);
  const place = page.getByRole("button", { name: "Place order (cash on delivery)" });
  await expect(place).toBeDisabled(); // OTP first
  await details.getByRole("button", { name: "Send code by SMS" }).click();
  await expect(details.getByText("We sent a 6-digit code by SMS.")).toBeVisible();
  await details.getByLabel("6-digit code").fill("123456");
  await details.getByRole("button", { name: "Verify" }).click();
  await expect(details.getByText("Mobile number verified.").first()).toBeVisible();
  await details.getByLabel("Email (for your invoice)").fill("guest.e2e@ecom.test");

  const address = page.getByRole("group", { name: "Delivery address" });
  await address.getByLabel("Division").selectOption("Dhaka");
  await address.getByLabel("District").selectOption("Dhaka");
  // Dhaka's upazilas load into a list (other districts take a typed name).
  await address.getByRole("combobox", { name: "Upazila or thana" }).selectOption("Dhanmondi");
  await address.getByLabel("Area").fill("Dhanmondi 27");
  await address.getByLabel("Address line").fill("House 10, Road 27");
  await expect(page.getByRole("region", { name: `Shop order 1: ${BOOK_SHOP}` })).toContainText("Delivery chargeTk 70 (up to 1 kg)");

  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await place.click();
  await expect(page).toHaveURL(/\/orders\/BD-\d{6}-[A-Z0-9]{5}\?placed=1$/);
  const orderNo = orderNoFrom(page.url());
  await expect(page.getByRole("heading", { level: 1, name: `Order ${orderNo}` })).toBeVisible();
  await expect(page.getByLabel("Order total")).toContainText("Total (cash on delivery)Tk 320");

  // Another browser (no cookies) can't open it, but tracking with number + OTP works.
  const other = await browser.newContext();
  const tracker = await other.newPage();
  await tracker.goto(`/orders/${orderNo}`);
  await expect(tracker.getByRole("heading", { level: 1, name: "Order not found" })).toBeVisible();
  await tracker.getByRole("link", { name: "track it with a code sent to your mobile" }).click();
  await expect(tracker.getByLabel("Order number")).toHaveValue(orderNo);
  await tracker.getByRole("button", { name: "Send code by SMS" }).click();
  await expect(tracker.getByText(/we sent a 6-digit code by SMS/)).toBeVisible();
  await tracker.getByLabel("6-digit code").fill("000000");
  await tracker.getByRole("button", { name: "View order" }).click();
  await expect(tracker.getByText("That code is not right. Check it and try again.")).toBeVisible();
  await tracker.getByLabel("6-digit code").fill("123456");
  await tracker.getByRole("button", { name: "View order" }).click();
  await expect(tracker.getByRole("heading", { level: 1, name: `Order ${orderNo}` })).toBeVisible();
  await expect(tracker.getByTestId("shop-order-status")).toHaveText("Placed, waiting for the shop");
  await expect(tracker.getByRole("link", { name: /^Report a problem/ })).toBeVisible();
  await other.close();

  const [row] = await query<{ user_id: string | null; phone_verified_at: Date | null }>(
    `SELECT user_id, phone_verified_at FROM "order" WHERE order_no = $1`,
    [orderNo],
  );
  expect(row.user_id).toBeNull();
  expect(row.phone_verified_at).not.toBeNull();

  // US-009: signing up later with the same mobile and verifying it brings the order into My orders.
  const later = await browser.newContext();
  const signup = await later.newPage();
  await signup.goto("/signup");
  await signup.getByLabel("Full name").fill("[TEST] E2E guest");
  await signup.getByLabel("Mobile number").fill(mobile);
  await signup.getByLabel("Password").fill("Secret@123");
  await signup.getByLabel(/I have read and accept/).check();
  await signup.getByRole("button", { name: "Create account" }).click();
  await signup.getByRole("button", { name: "Send code by SMS" }).click();
  await expect(signup.getByText("We sent a 6-digit code")).toBeVisible();
  await signup.getByLabel("6-digit code").fill("123456");
  await signup.getByRole("button", { name: "Verify" }).click();
  await expect(signup.getByText("Your mobile number is verified.")).toBeVisible();
  await signup.goto("/account/orders");
  await expect(signup.getByRole("link", { name: orderNo })).toBeVisible();
  await later.close();
});

test("the flagged customer (2 refused deliveries) is blocked from cash on delivery", async ({ page }) => {
  await query(
    `INSERT INTO cart_item (id, user_id, product_id, variant_id, shop_id, quantity, saved_for_later, price_at_add, created_at, updated_at)
     SELECT 'e2e-flagged-para', u.id, p.id, v.id, p.shop_id, 1, false, v.price, now(), now()
     FROM "user" u, product p JOIN product_variant v ON v.product_id = p.id
     WHERE u.email = 'customer.flagged@ecom.test' AND p.id = $1
     ON CONFLICT (user_id, variant_id) DO UPDATE SET saved_for_later = false, price_at_add = EXCLUDED.price_at_add`,
    [ids[PARA]],
  );
  await login(page, "customer.flagged@ecom.test", "/checkout");
  const message = /Cash on delivery is not available for this mobile number because earlier deliveries were refused/;
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await page.getByRole("button", { name: "Place order (cash on delivery)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: message })).toHaveCount(2);
  await expect(page).toHaveURL(/\/checkout$/);
});

test("a shop sees only its own shop orders, and can print their invoices", async ({ page }) => {
  const shops = await query<{ id: string; slug: string }>(`SELECT id, slug FROM shop WHERE slug IN ('test-tech-shop', 'test-book-shop')`);
  const tech = shops.find((s) => s.slug === "test-tech-shop")!.id;
  const books = shops.find((s) => s.slug === "test-book-shop")!.id;
  await login(page, "owner.tech@ecom.test", `/seller/${tech}/orders`);
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const list = page.getByRole("list", { name: "Shop orders" });
  await expect(list.getByRole("heading", { name: "BD-261005-SEEDA-1" })).toBeVisible(); // seeded, delivered
  await expect(list).not.toContainText("BD-261015-SEEDB"); // the book shop's order
  await expect(list).not.toContainText("Himu");
  await list.getByRole("link", { name: "Print invoice for BD-261005-SEEDA-1" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
  await expect(page.getByText("Invoice no. BD-261005-SEEDA-1")).toBeVisible();

  // Another shop's orders page is "not found" for this owner.
  await page.goto(`/seller/${books}/orders`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
