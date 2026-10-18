import "dotenv/config";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// US-053 and US-082: shop staff confirm, pack, hand over (courier + tracking) and deliver an
// order, which records its COD collection; a customer cancels an order the shop has not confirmed
// (the stock goes back); the admin sees an overdue order and creates and pays a payout.
// Needs seed data (`npm run seed`). Each run inserts its own orders (never deleted), so it can
// be repeated.
const RAM = "[TEST] Corsair Vengeance 16GB DDR5 RAM";
const RYZEN = "[TEST] AMD Ryzen 5 7600 Processor";
const SHIRT = "[TEST] Oxford cotton shirt";
const CUSTOMER = "lifecycle.e2e@ecom.test";
const CUSTOMER_ID = "e2e-lifecycle-customer";

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=.*$/, "") });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const newOrderNo = () => `BD-261017-${Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join("")}`;

/** Inserts a placed one-item COD order as checkout writes it (stock is not touched). */
async function insertOrder(opts: { title: string; optionKey?: string; quantity?: number; placedHoursAgo: number }) {
  const orderNo = newOrderNo();
  const id = `e2e-lc-${orderNo}`;
  const qty = opts.quantity ?? 1;
  const [v] = await query<{ variant_id: string; product_id: string; shop_id: string; shop_name: string; category_id: string; price: string; sku: string; stock: number }>(
    `SELECT v.id AS variant_id, p.id AS product_id, p.shop_id, s.name AS shop_name, p.category_id, v.price::text, v.sku, v.stock
     FROM product p JOIN product_variant v ON v.product_id = p.id JOIN shop s ON s.id = p.shop_id
     WHERE p.title = $1 AND p.deleted_at IS NULL AND v.option_key = $2`,
    [opts.title, opts.optionKey ?? ""],
  );
  const items = (Number(v.price) * qty).toFixed(2);
  const total = (Number(v.price) * qty + 70).toFixed(2);
  const placed = `now() - interval '${opts.placedHoursAgo} hours'`;
  await query(
    `INSERT INTO "order" (id, order_no, user_id, contact_name, contact_phone, phone_verified_at, contact_email, address, zone,
       items_subtotal, delivery_total, grand_total, policy_versions, idempotency_key, placed_at, sms_sent_at, email_sent_at, updated_at)
     VALUES ($1, $2, $3, '[TEST] Lifecycle shopper', '+8801710000301', now(), $4,
       '{"name":"[TEST] Lifecycle shopper","phone":"+8801710000301","division":"Dhaka","district":"Dhaka","upazila":"Dhanmondi","area":"Dhanmondi 27","line1":"House 1"}',
       'inside_dhaka', $5, 70, $6, '[]', $1, ${placed}, now(), now(), now())`,
    [id, orderNo, CUSTOMER_ID, CUSTOMER, items, total],
  );
  await query(
    `INSERT INTO shop_order (id, order_id, shop_id, seq, status, status_changed_at, shop_name, items_subtotal, weight_grams, delivery_charge,
       total, vat_rate, vat_amount, commission_amount, handover_due_at, updated_at)
     VALUES ($1, $1, $2, 1, 'placed', ${placed}, $3, $4, 500, 70, $5, 0, 0, 0, ${placed} + interval '48 hours', now())`,
    [id, v.shop_id, v.shop_name, items, total],
  );
  await query(
    `INSERT INTO order_item (id, shop_order_id, product_id, variant_id, category_id, title, sku, unit_price, quantity, line_total, unit_weight_grams, commission_rate)
     VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, 500, 0)`,
    [id, v.product_id, v.variant_id, v.category_id, opts.title, v.sku, v.price, qty, items],
  );
  return { orderNo, shopOrderId: id, shopId: v.shop_id, variantId: v.variant_id, total };
}

const stockOf = async (variantId: string) => (await query<{ stock: number }>(`SELECT stock FROM product_variant WHERE id = $1`, [variantId]))[0].stock;

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await query(
    `INSERT INTO "user" (id, email, phone, phone_verified_at, name, password_hash, email_verified_at, created_at, updated_at)
     SELECT $1, $2, '+8801710000301', now(), '[TEST] Lifecycle shopper', password_hash, now(), now(), now()
     FROM "user" WHERE email = 'customer.verified@ecom.test'
     ON CONFLICT (email) DO NOTHING`,
    [CUSTOMER_ID, CUSTOMER],
  );
});

test("shop staff confirm, pack, hand over and deliver an order; the COD collection is recorded", async ({ page }) => {
  const order = await insertOrder({ title: RAM, placedHoursAgo: 1 });
  const shopOrderNo = `${order.orderNo}-1`;
  await login(page, "staff.tech@ecom.test", `/seller/${order.shopId}/orders`);
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();

  const entry = page.getByRole("listitem", { name: `Shop order ${shopOrderNo}` });
  await expect(entry.getByTestId("shop-order-status")).toHaveText("Placed, waiting for the shop");
  await expect(entry.getByTestId("handover-countdown")).toHaveText(/^1 d 2[23] h left to hand over$/);
  await entry.getByRole("link", { name: shopOrderNo, exact: true }).click();

  await expect(page.getByRole("heading", { level: 1, name: `Shop order ${shopOrderNo}` })).toBeVisible();
  // Cache Components keeps the previous page hidden in the DOM: only look at what is visible.
  const status = page.getByTestId("shop-order-status").locator("visible=true");
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(status).toHaveText("Confirmed by the shop");
  await page.getByRole("button", { name: "Mark packed" }).click();
  await expect(status).toHaveText("Packed");

  // Handover needs the courier and the tracking number.
  const handover = page.getByRole("form", { name: `Hand over ${shopOrderNo}` });
  await handover.getByRole("button", { name: "Hand over to courier" }).click();
  await expect(handover.getByRole("alert")).toContainText("Enter the courier's name");
  await handover.getByRole("textbox", { name: "Courier" }).fill("RedX");
  await handover.getByRole("textbox", { name: "Tracking number" }).fill("RX-E2E-0001");
  await handover.getByRole("button", { name: "Hand over to courier" }).click();
  await expect(status).toHaveText("With the courier");
  await expect(page.getByText("Courier: RedX, tracking number RX-E2E-0001")).toBeVisible();
  await expect(page.getByText(/\(within 48 h\)/).locator("visible=true").first()).toBeVisible();

  // Test mode: no courier feed, so the shop marks the delivery.
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(status).toHaveText("Delivered");
  const timeline = page.getByRole("list", { name: `Timeline of ${shopOrderNo}` });
  for (const step of ["Order placed", "Confirmed by the shop", "Packed", "Handed over to the courier", "Delivered"]) {
    await expect(timeline).toContainText(step);
  }

  const [row] = await query<{ status: string; handed_over_at: Date | null; courier_name: string; delivered_at: Date | null }>(
    `SELECT status, handed_over_at, courier_name, delivered_at FROM shop_order WHERE id = $1`,
    [order.shopOrderId],
  );
  expect(row).toMatchObject({ status: "delivered", courier_name: "RedX" });
  expect(row.handed_over_at).not.toBeNull();
  const events = await query<{ action: string }>(`SELECT action FROM shop_order_event WHERE shop_order_id = $1 ORDER BY at`, [order.shopOrderId]);
  expect(events.map((e) => e.action)).toEqual(["confirm", "pack", "hand_over", "deliver"]);
  const [collection] = await query<{ amount: string; source: string; days: number }>(
    `SELECT amount::text, source, round(extract(epoch FROM payout_due_at - collected_at) / 86400)::int AS days FROM cod_collection WHERE shop_order_id = $1`,
    [order.shopOrderId],
  );
  expect(collection).toEqual({ amount: order.total, source: "auto_on_delivery", days: 10 });

  // The packing slip of the order prints without the site header.
  await page.getByRole("link", { name: "Print packing slip" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Packing slip" })).toBeVisible();
  await expect(page.getByText(`Collect cash on delivery: Tk ${Number(order.total).toLocaleString("en-US")}`)).toBeVisible();
});

test("a customer cancels an order the shop has not confirmed; the stock goes back", async ({ page }) => {
  const order = await insertOrder({ title: RYZEN, quantity: 2, placedHoursAgo: 2 });
  const before = await stockOf(order.variantId);
  await login(page, CUSTOMER, `/orders/${order.orderNo}`);
  await expect(page.getByRole("heading", { level: 1, name: `Order ${order.orderNo}` })).toBeVisible();
  const card = page.getByRole("region", { name: new RegExp(`^Shop order ${order.orderNo}-1: `) });
  await expect(card.getByTestId("shop-order-status")).toHaveText("Placed, waiting for the shop");
  await card.getByText("Cancel this shop order").click();
  await card.getByRole("textbox", { name: "Reason (optional)" }).fill("Ordered by mistake");
  await card.getByRole("button", { name: "Cancel shop order" }).click();
  await expect(card.getByTestId("shop-order-status")).toHaveText("Cancelled");
  await expect(card.getByRole("list", { name: `Timeline of ${order.orderNo}-1` })).toContainText("Cancelled by the customer");
  await expect(card).toContainText("Reason: Ordered by mistake");
  expect(await stockOf(order.variantId)).toBe(before + 2);
  const [row] = await query<{ status: string; cancelled_by: string; restocked_at: Date | null }>(`SELECT status, cancelled_by, restocked_at FROM shop_order WHERE id = $1`, [order.shopOrderId]);
  expect(row.status).toBe("cancelled");
  expect(row.cancelled_by).toBe("customer");
  expect(row.restocked_at).not.toBeNull();
});

test("the admin sees an overdue order, then creates a payout for the shop and marks it paid", async ({ page }) => {
  const overdue = await insertOrder({ title: SHIRT, optionKey: "colour=black;size=m", placedHoursAgo: 50 });
  const shopOrderNo = `${overdue.orderNo}-1`;
  await login(page, "admin@ecom.test", "/admin/orders?overdue=1");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const entry = page.getByRole("listitem", { name: `Shop order ${shopOrderNo}` });
  await expect(entry.getByTestId("overdue-badge")).toHaveText("Overdue");
  await expect(entry.getByTestId("handover-countdown")).toHaveText(/^Overdue by 2 h/);
  await expect(page.getByTestId("handover-rate")).toContainText("target 95%");

  // Payouts: the Tech shop has at least the collection of the order delivered above.
  const [tech] = await query<{ id: string; name: string }>(`SELECT id, name FROM shop WHERE slug = 'test-tech-shop'`);
  await page.goto("/admin/payouts");
  await expect(page.getByRole("heading", { level: 1, name: "Payouts" })).toBeVisible();
  const latestPending = async () =>
    (
      await query<{ id: string; net: string; gross: string; commission: string }>(
        `SELECT id, net::text, gross::text, commission::text FROM payout WHERE shop_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
        [tech.id],
      )
    )[0];
  const before = (await latestPending())?.id ?? null;
  await page.getByRole("listitem", { name: `Due: ${tech.name}` }).getByRole("button", { name: "Create payout" }).click();
  await expect.poll(async () => (await latestPending())?.id ?? null).not.toBe(before);
  const payout = await latestPending();
  expect(Number(payout.net)).toBeCloseTo(Number(payout.gross) - Number(payout.commission), 2);
  const pending = page.getByRole("listitem", { name: `Payout ${payout.id}` });
  await pending.getByRole("combobox", { name: "Paid by" }).selectOption("bkash");
  await pending.getByRole("textbox", { name: "Transaction or cheque reference" }).fill("TRX-E2E-1");
  await pending.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByRole("listitem", { name: `Payout ${payout.id}` })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Recently paid" })).toContainText("ref. TRX-E2E-1");

  const [paid] = await query<{ status: string; method: string; unpaid: string }>(
    `SELECT p.status, p.method, (SELECT count(*)::text FROM cod_collection c WHERE c.payout_id = p.id AND c.paid_out_at IS NULL) AS unpaid FROM payout p WHERE p.id = $1`,
    [payout.id],
  );
  expect(paid).toEqual({ status: "paid", method: "bkash", unpaid: "0" });
});
