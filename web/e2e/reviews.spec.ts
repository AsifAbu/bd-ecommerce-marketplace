import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// US-055 ratings and reviews. A customer reviews a delivered item from the order page and sees
// it on the product page; a staff member of the selling shop can't review that shop's product;
// the Platform Admin hides the review with a reason (logged), and it leaves the product page.
// Needs seed data (`npm run seed`). Each run makes its own delivered orders (reviews and orders
// are never deleted), so it can be re-run.
const R7 = "[TEST] AMD Ryzen 7 7700X Processor";
const RAM = "[TEST] Corsair Vengeance 16GB DDR5 RAM";
const BUYER = "reviews.e2e@ecom.test";
const BUYER_PHONE = "+8801710000401";
// Order-number characters (no look-alikes), so the test orders have valid numbers.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const run = code();
const REVIEW_TITLE = `Quick and cool ${run}`;

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** A delivered one-item order from the product's shop for this user, as checkout + delivery leave it. */
async function deliveredOrder(userId: string, phone: string, productTitle: string, tag: string) {
  const [p] = await query<{ id: string; shop_id: string; shop_name: string; category_id: string; variant_id: string; price: string }>(
    `SELECT p.id, p.shop_id, s.name AS shop_name, p.category_id, v.id AS variant_id, v.price
     FROM product p JOIN shop s ON s.id = p.shop_id JOIN product_variant v ON v.product_id = p.id
     WHERE p.title = $1 AND p.deleted_at IS NULL LIMIT 1`,
    [productTitle],
  );
  const id = `e2e-rv-${tag}-${run}`;
  const orderNo = `BD-261012-${code()}`;
  await query(
    `INSERT INTO "order" (id, order_no, user_id, contact_name, contact_phone, phone_verified_at, address, zone, items_subtotal,
       delivery_total, grand_total, policy_versions, idempotency_key, placed_at, created_at, updated_at)
     VALUES ($1, $2, $3, '[TEST] Reviews e2e', $4, now(), $5, 'inside_dhaka', $6::numeric, 70, $6::numeric + 70, '[]', $1, now() - interval '5 days', now(), now())`,
    [id, orderNo, userId, phone, JSON.stringify({ name: "[TEST] Reviews e2e", phone, division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", area: "Road 1", line1: "House 1" }), p.price],
  );
  await query(
    `INSERT INTO shop_order (id, order_id, shop_id, seq, status, shop_name, items_subtotal, weight_grams, delivery_charge, total,
       vat_rate, vat_amount, commission_amount, handover_due_at, delivered_at, created_at, updated_at)
     VALUES ($1, $1, $2, 1, 'delivered', $3, $4::numeric, 250, 70, $4::numeric + 70, 0, 0, 0, now(), now() - interval '1 day', now(), now())`,
    [id, p.shop_id, p.shop_name, p.price],
  );
  await query(
    `INSERT INTO order_item (id, shop_order_id, product_id, variant_id, category_id, title, unit_price, quantity, line_total,
       unit_weight_grams, commission_rate, created_at)
     VALUES ($1, $1, $2, $3, $4, $5, $6::numeric, 1, $6::numeric, 250, 0, now())`,
    [id, p.id, p.variant_id, p.category_id, productTitle, p.price],
  );
  return { orderNo, itemId: id, productId: p.id };
}

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

test.describe.configure({ mode: "serial" });

let buyerOrder: { orderNo: string; itemId: string; productId: string };
let staffOrder: { orderNo: string; itemId: string; productId: string };

test.beforeAll(async () => {
  // Our own customer (same password as the seed users).
  await query(
    `INSERT INTO "user" (id, email, phone, phone_verified_at, name, password_hash, email_verified_at, created_at, updated_at)
     SELECT 'e2e-reviews-buyer', $1, $2, now(), '[TEST] Nadia Rahman', password_hash, now(), now(), now()
     FROM "user" WHERE email = 'customer.verified@ecom.test'
     ON CONFLICT (email) DO NOTHING`,
    [BUYER, BUYER_PHONE],
  );
  buyerOrder = await deliveredOrder("e2e-reviews-buyer", BUYER_PHONE, R7, "B");
  const [staff] = await query<{ id: string }>(`SELECT id FROM "user" WHERE email = 'staff.tech@ecom.test'`);
  staffOrder = await deliveredOrder(staff.id, "+8801710000302", RAM, "S");
});

test("a customer reviews a delivered item from the order page and sees it on the product page", async ({ page }) => {
  await login(page, BUYER, "/account/orders");
  await expect(page.getByTestId("reviews-link")).toContainText(/delivered items? (is|are) waiting for your review/);

  await page.goto(`/orders/${buyerOrder.orderNo}`);
  await page.getByRole("link", { name: "Write a review" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your review" })).toBeVisible();
  await expect(page.getByRole("link", { name: R7 })).toBeVisible();

  // The rating is required.
  const form = page.getByRole("form", { name: "Write a review" });
  await form.getByRole("button", { name: "Publish review" }).click();
  await expect(form.getByRole("alert")).toContainText("Choose a rating from 1 to 5 stars");

  await page.getByRole("radio", { name: "5 stars: excellent" }).check();
  await page.getByLabel("Title (optional)").fill(REVIEW_TITLE);
  await page.getByLabel("Your review (optional)").fill("Runs cool with a tower cooler. Delivered in 2 days.");
  await form.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByText("Thank you! Your review is published on the product page.")).toBeVisible();

  // Back on the order: the item shows the review, which can be edited for 30 days.
  await page.goto(`/orders/${buyerOrder.orderNo}`);
  await expect(page.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit your review" })).toBeVisible();

  // A second review of the same item is refused by the API (one per item).
  const again = await page.request.post("/api/reviews", { data: { orderItemId: buyerOrder.itemId, rating: 1 } });
  expect(again.status()).toBe(409);
  expect((await again.json()).error.code).toBe("ALREADY_REVIEWED");
  // And reviews can't be deleted.
  const [{ id: reviewId }] = await query<{ id: string }>(`SELECT id FROM review WHERE order_item_id = $1`, [buyerOrder.itemId]);
  expect((await page.request.delete(`/api/reviews/${reviewId}`)).status()).toBe(405);

  // The product page shows the rating and the review, marked as a verified purchase.
  await page.goto(`/products/${buyerOrder.productId}`);
  await expect(page.getByTestId("rating-summary")).toContainText("review");
  const reviews = page.getByRole("region", { name: "Ratings and reviews" });
  const mine = reviews.getByTestId("review").filter({ hasText: REVIEW_TITLE });
  await expect(mine).toContainText("Verified purchase");
  await expect(mine).toContainText("Nadia R.");
  await expect(mine.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();

  // Search: the "4 stars & up" filter keeps the rated processor and drops the unrated one.
  await page.goto("/search?q=processor&rating=4");
  await expect(page.getByRole("group", { name: "Customer rating" }).getByRole("radio", { name: /4 stars & up/ })).toBeChecked();
  await expect(page.getByRole("link", { name: /Ryzen 7 7700X/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ryzen 5 7600/ })).toHaveCount(0);

  // The JSON API serves the same review.
  const api = await page.request.get(`/api/products/${buyerOrder.productId}/reviews`);
  expect(api.status()).toBe(200);
  expect((await api.json()).reviews.map((r: { title: string }) => r.title)).toContain(REVIEW_TITLE);
});

test("shop staff can't review their own shop's product, even from their own delivered order", async ({ page }) => {
  await login(page, "staff.tech@ecom.test", `/orders/${staffOrder.orderNo}`);
  await expect(page.getByText("Shop members can't review their own shop's products")).toBeVisible();
  await expect(page.getByRole("link", { name: "Write a review" })).toHaveCount(0);

  await page.goto(`/account/reviews/${staffOrder.itemId}`);
  await expect(page.getByTestId("review-blocked")).toContainText("Shop owners and staff can't review products of their own shop");
  await expect(page.getByRole("button", { name: "Publish review" })).toHaveCount(0);

  const res = await page.request.post("/api/reviews", { data: { orderItemId: staffOrder.itemId, rating: 5, text: "Best RAM ever" } });
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: { code: "SHOP_MEMBER", message: "Shop owners and staff can't review products of their own shop" } });
  expect(await query(`SELECT id FROM review WHERE order_item_id = $1`, [staffOrder.itemId])).toEqual([]);
});

test("the Platform Admin hides the review with a reason; it leaves the product page and is logged", async ({ page }) => {
  // A customer can't use the moderation API.
  await login(page, BUYER, "/account/reviews");
  const [{ id: reviewId }] = await query<{ id: string }>(`SELECT id FROM review WHERE order_item_id = $1`, [buyerOrder.itemId]);
  expect((await page.request.post(`/api/admin/reviews/${reviewId}/hide`, { data: { reason: "Not mine to hide" } })).status()).toBe(403);
  await page.context().clearCookies();

  await login(page, "01700000001", "/admin/reviews");
  await expect(page.getByRole("heading", { level: 1, name: "Reviews: moderation" })).toBeVisible();
  const card = page.getByTestId("admin-review").filter({ hasText: REVIEW_TITLE });
  await card.getByLabel("Reason for hiding").fill("Mentions a competitor's shop");
  await card.getByRole("button", { name: "Hide review" }).click();
  // It leaves the "Published" list.
  await expect(card).toHaveCount(0);

  // Listed under Hidden with the reason; gone from the product page; written to the audit log.
  await page.goto("/admin/reviews?status=hidden");
  await expect(page.getByTestId("admin-review").filter({ hasText: REVIEW_TITLE })).toContainText("Mentions a competitor's shop");
  await page.goto(`/products/${buyerOrder.productId}`);
  await expect(page.getByRole("region", { name: "Ratings and reviews" })).not.toContainText(REVIEW_TITLE);
  const audit = await query<{ action: string; data: { reason: string } }>(`SELECT action, data FROM audit_log WHERE entity = 'review' AND entity_id = $1`, [reviewId]);
  expect(audit).toEqual([{ action: "review.hidden", data: expect.objectContaining({ reason: "Mentions a competitor's shop" }) }]);
  // Never deleted: the row is still there, hidden.
  expect(await query(`SELECT status, hidden_reason FROM review WHERE id = $1`, [reviewId])).toEqual([{ status: "hidden", hidden_reason: "Mentions a competitor's shop" }]);
});
