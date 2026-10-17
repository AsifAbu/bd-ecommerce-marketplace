import "dotenv/config";
import { randomInt } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

// US-070, US-071, US-072. A customer requests a return on a delivered order (a fresh copy of the
// seeded order BD-261001-RTNA2 each run, so the test can repeat: returns are never deleted), the
// shop accepts it and records the refund (the customer's notification job is queued); an 8-day-old
// delivery and a medicine item are blocked; a customer opens a complaint and the admin resolves it.
// Needs seed data (`npm run seed`).

const CUSTOMER = "customer.verified@ecom.test";
const FASHION_STAFF = "staff.fashion@ecom.test";
const ADMIN = "admin@ecom.test";
const OLD_ORDER = "BD-261001-RTNK3"; // delivered 8 days ago
const MEDICINE_ORDER = "BD-261001-RTNJ2";

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
const orderNo = `BD-261017-${Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
let shopOrderNo = "";
let fashionShopId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // A fresh delivered order (delivered 2 days ago), copied from the seeded RTNA2 order.
  const id = `e2e-ret-${orderNo}`;
  await query(
    `INSERT INTO "order" (id, order_no, user_id, contact_name, contact_phone, phone_verified_at, contact_email, address, zone, items_subtotal,
       delivery_total, grand_total, payment_method, policy_versions, idempotency_key, sms_sent_at, email_sent_at, placed_at, created_at, updated_at)
     SELECT $1, $2, user_id, contact_name, contact_phone, phone_verified_at, contact_email, address, zone, items_subtotal, delivery_total, grand_total,
       payment_method, policy_versions, 'e2e:' || $2, now(), now(), now() - interval '5 days', now(), now()
     FROM "order" WHERE order_no = 'BD-261001-RTNA2'`,
    [id, orderNo],
  );
  await query(
    `INSERT INTO shop_order (id, order_id, shop_id, seq, status, status_changed_at, shop_name, shop_registration, items_subtotal, weight_grams,
       delivery_charge, free_delivery, total, vat_rate, vat_amount, commission_amount, launch_offer, handover_due_at, delivered_at, created_at, updated_at)
     SELECT $1 || '-so', $1, shop_id, seq, 'delivered', now() - interval '2 days', shop_name, shop_registration, items_subtotal, weight_grams,
       delivery_charge, free_delivery, total, vat_rate, vat_amount, commission_amount, launch_offer, handover_due_at, now() - interval '2 days', now(), now()
     FROM shop_order WHERE order_id = (SELECT id FROM "order" WHERE order_no = 'BD-261001-RTNA2')`,
    [id],
  );
  await query(
    `INSERT INTO order_item (id, shop_order_id, product_id, variant_id, category_id, title, variant_label, sku, unit_price, quantity, line_total,
       unit_weight_grams, warranty, commission_rate, return_eligibility, created_at)
     SELECT $1 || '-i', $1 || '-so', product_id, variant_id, category_id, title, variant_label, sku, unit_price, quantity, line_total,
       unit_weight_grams, warranty, commission_rate, return_eligibility, now()
     FROM order_item WHERE shop_order_id = (SELECT so.id FROM shop_order so JOIN "order" o ON o.id = so.order_id WHERE o.order_no = 'BD-261001-RTNA2')`,
    [id],
  );
  shopOrderNo = `${orderNo}-1`;
  // Keep the old order 8 days past delivery and the medicine order fresh, whenever the seed ran.
  await query(`UPDATE shop_order SET delivered_at = now() - interval '8 days' WHERE order_id = (SELECT id FROM "order" WHERE order_no = $1)`, [OLD_ORDER]);
  await query(`UPDATE shop_order SET delivered_at = now() - interval '1 day' WHERE order_id = (SELECT id FROM "order" WHERE order_no = $1)`, [MEDICINE_ORDER]);
  const [shop] = await query<{ id: string }>(`SELECT id FROM shop WHERE slug = 'test-fashion-shop'`);
  fashionShopId = shop.id;
});

async function loginAs(browser: Browser, identifier: string, callbackUrl: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === callbackUrl.split("?")[0]);
  return page;
}

test("a customer requests a return; the shop accepts and records the refund; the customer is notified", async ({ browser }) => {
  const customer = await loginAs(browser, CUSTOMER, `/orders/${orderNo}`);
  await customer.getByRole("link", { name: /^Request a return/ }).click();
  await expect(customer.getByRole("heading", { name: "Request a return" })).toBeVisible();
  await customer.getByLabel("How many to return").selectOption("1");
  await customer.getByLabel("Wrong item, size or colour").check();
  await customer.getByLabel("What is wrong?").fill("Ordered size M, received size L.");
  await customer.getByRole("button", { name: "Send return request" }).click();
  await customer.waitForURL(new RegExp(`/orders/${orderNo}\\?return=requested`));
  await expect(customer.getByText("Return requested. The shop answers within 48 hours")).toBeVisible();
  await expect(customer.getByTestId("return-status")).toHaveText("Waiting for the shop");

  const shop = await loginAs(browser, FASHION_STAFF, `/seller/${fashionShopId}/returns`);
  const card = shop.getByTestId("return-card").filter({ hasText: shopOrderNo });
  await expect(card).toHaveCount(1);
  await card.getByLabel("Note to the customer (optional)").fill("Courier collects it tomorrow.");
  await card.getByRole("button", { name: "Accept return" }).click();
  await expect(card.getByTestId("return-status")).toHaveText("Accepted by the shop");
  await card.getByLabel("Paid by").selectOption("bkash");
  await card.getByLabel("Transaction ID or receipt").fill("E2E8N7A6B5C");
  await card.getByRole("button", { name: "Record refund" }).click();
  await expect(card.getByTestId("return-status")).toHaveText("Refunded");
  await expect(card.getByTestId("return-refund")).toContainText("by bKash, reference E2E8N7A6B5C");

  const [row] = await query<{ status: string; refund_method: string; refund_reference: string; refund_amount: string; id: string }>(
    `SELECT r.id, r.status, r.refund_method, r.refund_reference, r.refund_amount FROM return_request r JOIN "order" o ON o.id = r.order_id WHERE o.order_no = $1`,
    [orderNo],
  );
  expect(row).toMatchObject({ status: "refunded", refund_method: "bkash", refund_reference: "E2E8N7A6B5C" });
  // The customer's SMS/email go through the returns.notify job.
  const jobs = await query<{ event: string }>(`SELECT data->>'event' AS event FROM pgboss.job WHERE name = 'returns.notify' AND data->>'returnId' = $1`, [row.id]);
  expect(jobs.map((j) => j.event).sort()).toEqual(["accepted", "refunded", "requested"]);

  await customer.reload();
  await expect(customer.getByTestId("return-status")).toHaveText("Refunded");
  await expect(customer.getByTestId("return-refund")).toContainText("E2E8N7A6B5C");
});

test("a delivery 8 days ago is blocked with the 7-day policy message; medicine needs damage or a wrong item", async ({ browser }) => {
  const customer = await loginAs(browser, CUSTOMER, `/orders/${OLD_ORDER}/return`);
  await expect(customer.getByTestId("return-blocked")).toContainText("Returns are accepted within 7 days of delivery");
  await expect(customer.getByRole("button", { name: "Send return request" })).toHaveCount(0);

  const [old] = await query<{ id: string }>(`SELECT i.id FROM order_item i JOIN shop_order so ON so.id = i.shop_order_id JOIN "order" o ON o.id = so.order_id WHERE o.order_no = $1`, [OLD_ORDER]);
  const res = await customer.request.post("/api/returns", { data: { orderNo: OLD_ORDER, orderItemId: old.id, quantity: 1, reason: "damaged" } });
  expect(res.status()).toBe(422);
  expect((await res.json()).error.code).toBe("RETURN_WINDOW_CLOSED");

  const [med] = await query<{ id: string }>(`SELECT i.id FROM order_item i JOIN shop_order so ON so.id = i.shop_order_id JOIN "order" o ON o.id = so.order_id WHERE o.order_no = $1`, [MEDICINE_ORDER]);
  const blocked = await customer.request.post("/api/returns", { data: { orderNo: MEDICINE_ORDER, orderItemId: med.id, quantity: 1, reason: "not_as_described" } });
  expect(blocked.status()).toBe(422);
  expect((await blocked.json()).error).toMatchObject({ code: "RETURN_NOT_ELIGIBLE", message: expect.stringMatching(/^Medicine can't be returned/) });

  await customer.goto(`/orders/${MEDICINE_ORDER}/return`);
  await expect(customer.getByText(/^Medicine can't be returned/)).toBeVisible();
  await expect(customer.getByLabel("Changed my mind")).toHaveCount(0);
});

test("a customer opens a complaint and the admin resolves it within the 72 h queue", async ({ browser }) => {
  const subject = `Parcel box was open ${orderNo}`;
  const customer = await loginAs(browser, CUSTOMER, `/orders/${orderNo}`);
  await customer.getByRole("link", { name: /^Report a problem/ }).click();
  await customer.getByLabel("What is it about?").selectOption("delivery");
  await customer.getByLabel("Subject").fill(subject);
  await customer.getByLabel("What happened?").fill("The parcel arrived with the box already open.");
  await customer.getByRole("button", { name: "Send complaint" }).click();
  await customer.waitForURL(/\/complaints\/[^/?]+\?opened=1/);
  await expect(customer.getByText(/received\. We will resolve it within 72 hours/)).toBeVisible();
  await expect(customer.getByTestId("complaint-status")).toHaveText("Open");
  const ticketUrl = new URL(customer.url()).pathname;

  const admin = await loginAs(browser, ADMIN, "/admin/complaints");
  await expect(admin.getByRole("complementary", { name: "Compliance officer" })).toBeVisible();
  await expect(admin.getByTestId("overdue-badge").first()).toBeVisible(); // the seeded CP-261001-TKTC4 is past 72 h
  await admin.getByRole("link", { name: new RegExp(subject) }).click();
  await admin.getByLabel("Resolution (sent to the customer)").fill("The shop sent a replacement box and checked the items.");
  await admin.getByRole("button", { name: "Mark resolved" }).click();
  await expect(admin.getByTestId("complaint-status")).toHaveText("Resolved");

  await customer.goto(ticketUrl);
  await expect(customer.getByTestId("complaint-status")).toHaveText("Resolved");
  await expect(customer.getByTestId("complaint-resolution")).toHaveText("The shop sent a replacement box and checked the items.");
});
