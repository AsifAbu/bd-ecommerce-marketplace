# Marketplace web app

Next.js (App Router) + TypeScript + Tailwind, Prisma + PostgreSQL, Auth.js v5, pg-boss jobs.
Conventions for contributors and agents: `../.claude/knowledge/dev-conventions.md`.

## Prerequisites

- Node.js 22.12+ and npm
- Docker (for Postgres, Meilisearch, MinIO, Mailpit)

## Run locally

```bash
cp .env.example .env            # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d            # Postgres :5432, Meilisearch :7700, MinIO :9100 (console :9101), Mailpit :8025
npm install                     # also runs `prisma generate`
npx prisma migrate dev          # apply migrations
npm run seed                    # test users
npm run dev                     # http://localhost:3000
npm run worker                  # background jobs (separate terminal; add -- --demo to send a test job)
```

Change host ports in `.env` if any are busy.

## Test mode

`APP_MODE=test` shows a "Test mode" banner on every page. No SMS is sent: the OTP code is always **123456**.
The app refuses to start with `APP_MODE=production` and the dummy OTP enabled.
`npm run seed` refuses to run unless `APP_MODE=test` (an unset `APP_MODE` means production); set `ALLOW_PRODUCTION_SEED=true` only to seed a production-mode database on purpose.

Seeded accounts (password `Test@12345`). Log in at `/api/auth/signin` with mobile or email:

| Account | Email | Mobile |
| --- | --- | --- |
| Platform Admin | admin@ecom.test | 01700000001 |
| Customer, verified phone and email | customer.verified@ecom.test | 01700000002 |
| Customer, new | customer.new@ecom.test | (none) |
| Customer, past COD refusals | customer.flagged@ecom.test | 01700000003 |

Seeded shops (approved): Test Tech Shop, Test Fashion Shop and Test Pharmacy (Verified; the pharmacy has a
verified dummy drug licence) and Test Book Shop (Basic). Each has `owner.<shop>@ecom.test` and
`staff.<shop>@ecom.test` (`<shop>` = tech, books, fashion, pharmacy, suspended for the suspended test shop), password `Test@12345`.

Shops pages: `/shops/apply` (apply), `/seller` (my shops), `/admin/shops` (Platform Admin review queue).
Uploaded documents go to the private MinIO bucket (`S3_BUCKET_PRIVATE`); in test mode any file is accepted.
Staff invite emails land in Mailpit (http://localhost:8025). The worker runs the daily licence-expiry job.

## Products (seller)

From the shop dashboard, **Products** opens `/seller/<shopId>/products` (owner and staff):

- **Add a product** (`/products/new`): choose a leaf category (shown with its path; medicine categories only for
  medicine shops with a verified licence), then fill the form generated from that category's schema. Categories
  with variant axes (e.g. size and colour) get one row per variant with its own price, stock and SKU.
- **Edit** (`/products/<productId>`): details and variants, quick stock update per variant, images (JPEG, PNG or
  WebP, up to 5 MB, 8 per product; the first is the cover), activate/deactivate and delete (soft delete).
- **Import from CSV** (`/products/import`): pick a category, download its template and see each column's allowed
  values. Rows with the same `handle` are one product with several variants; multi-value cells use `|`; yes/no
  columns accept yes/no/true/false/1/0; dates are `YYYY-MM-DD`. Up to 500 rows / 1 MB. All or nothing: if any
  row has a problem, nothing is imported and every problem is listed by line and column.

Rules: the shop must be approved; Basic shops can have 100 live listings; expired products are hidden
automatically. JSON API: `/api/shops/<shopId>/products/...`; images are served by `/api/product-images/<id>`
(redirect to a short-lived signed URL; uploads fail with a clear 503 when MinIO is not running). The worker's
daily `products.refresh-counts` job recounts each category's live listings. The seed adds two `[TEST]`
products per seeded shop (no images).

## Storefronts (US-014)

Every approved shop has a public storefront at `/s/<shop slug>` (the slug chosen at application, e.g.
`/s/test-tech-shop`): banner, logo, name, "Verified seller" badge, description, policies, member since, and a grid
of the shop's live, in-stock products (24 per page) linking to `/products/<productId>`. URL parameters:
`?category=<category slug>` (only categories the shop sells in), `?sort=newest|price_asc|price_desc`, `?page=<n>`.
Pending, rejected, suspended and unknown shops show "Shop not found" (noindex). Open Graph/Twitter tags use the
shop name, description and banner (or logo), so Facebook previews look right.

The seller dashboard shows the full link (base URL from `APP_URL`, else `AUTH_URL`) with **Copy link**, **Share on
Facebook** and **View storefront**, for the owner and staff; the admin shops list links each approved storefront.
The seed adds `[TEST] Suspended Shop` (`/s/test-suspended-shop`, suspended, one hidden product).

## Product page and wishlist

- **Product page** `/products/<productId>` (public, live listings only; anything else shows "Product not
  available"): images (placeholder when there are none or storage is down), price, size/colour picker with
  stock per choice (sold-out options disabled; the choice is kept in `?variant=`), specs in the category's
  display order, delivery charge, return eligibility, the seller with its "Verified seller" badge and a link to
  `/s/<shop slug>`. "Add to cart" adds the chosen variant (guests too).
- **Delivery charge** (`src/lib/delivery.ts`, decision D9): `deliveryCharge({ insideDhaka, weightGrams })` gives
  Tk 70 inside Dhaka / Tk 130 outside for the first kg, plus Tk 20 per started kg above 1 kg (per shop order);
  `deliveryBreakdown` gives the parts.
- **Wishlist** `/account/wishlist` (logged-in; header link "Wishlist"): price, variant and "In stock" /
  "Out of stock", remove. A guest who taps **Save to wishlist** logs in and comes back to the product with
  `?wishlist=add`, and the item is saved on the server. "Move to cart" (in-stock item with a chosen variant)
  adds it to the cart and removes it from the wishlist.
  JSON API: `GET/POST /api/wishlist`, `DELETE /api/wishlist/<itemId>`,
  `POST /api/wishlist/<itemId>/move-to-cart`. The seed gives `customer.verified@ecom.test` two items (one sold out).

## Cart

- **Cart** `/cart` (guests and customers; header link "Cart (n)"): one cart across shops, grouped by shop with
  each shop's subtotal, delivery charge (D9, by weight) and free-delivery hint ("Add Tk X more"; owners set the
  threshold on the seller dashboard profile). Quantity is capped at the stock with a message; a price change since
  adding shows a notice and **Checkout** waits for "Accept new price"; "Save for later" moves a line out of the
  totals; unavailable lines are listed apart. Delivery area: the choice on the cart page (cookie `cart_zone`),
  else the default address (district Dhaka = inside Dhaka), else inside Dhaka. `/checkout` is a placeholder.
- **Guests**: an httpOnly `cart_guest` cookie (30 days; only its SHA-256 is stored). At login or sign-up the
  Auth.js `signIn` event merges the guest cart into the account cart (quantities added, capped at the stock) and
  removes the cookie. The daily job `cart.purge-guest-carts` removes guest carts untouched for 30 days.
- **JSON API**: `GET /api/cart?zone=`, `POST /api/cart/items` `{ variantId, quantity? }`,
  `PATCH /api/cart/items/<id>` `{ quantity?, savedForLater?, acknowledgePrice? }`, `DELETE /api/cart/items/<id>`,
  `POST /api/cart/merge`. The owner comes from the session or cookie only; another owner's line is a 404.
- **For checkout (US-051)**: `resolveCartOwner`, `resolveDeliveryZone`, `cartService.getCart(owner, zone)` and
  `cartService.clearItems(owner, ids)` from `features/cart/server.ts`; `cartReadyForCheckout(cart)` from
  `features/cart`.
- The seed gives `customer.verified@ecom.test` a cart across the Test Tech Shop (free delivery from Tk 10,000) and
  the Test Book Shop, with one price change to accept and one item saved for later.

## Search and categories (shopper)

- **Header search box** → `/search?q=...`. Keywords match title, Bengali name, brand, attribute values and
  category names; Banglish and Bengali spellings are expanded (`boi` → book/বই, `sharee` → saree/শাড়ি; dictionary
  in `src/features/search/synonyms.ts`). Sellers can give a product an optional **Bengali name**.
- **`/categories`** and the home page show only categories with at least one live, in-stock product (counts roll up
  to parents); **`/c/<slug>`** lists a category's products. Empty categories are 404 for shoppers.
- **Filters** come from the category's filterable attributes (leaf categories) plus price and shop; a search
  across categories shows only those common filters and "Narrow by category". Facet counts are within the current
  results; options with 0 results are hidden. The URL is the whole state: `category=`, `f.<key>=<option>`
  (repeat for OR), `f.<key>.min=`/`.max=`, `f.<key>=1` (yes/no), `price_min=`, `price_max=`, `shop=<slug>`,
  `sort=relevance|price_asc|price_desc|newest`, `page=` (24 per page).
- **JSON**: `GET /api/search` (same parameters → `{ items, facets, total, page, perPage, totalPages, ... }`, header
  `x-search-engine`) and `GET /api/categories?visible=true`.
- **Engines**: Meilisearch when `MEILI_URL` is set and reachable; otherwise (or during an outage, retried every
  30 s) a Postgres adapter that reads live, in-stock products directly (fine for dev and seed data, capped at 2,000
  candidates). Product writes enqueue `search.reindex-product`; the worker runs `search.reindex-all` daily at
  01:30 Dhaka time, and `npm run seed` builds the index when Meilisearch is up.

Policies and compliance (US-080, US-081): public pages at `/policies/<slug>` (terms, privacy, returns,
delivery, seller, cookies; `?version=N` shows an earlier version), admin at `/admin/policies` (draft, publish,
history) and `/admin/compliance` (DBID and 6-year record retention). Seeds publish version 1 of every policy
with `[TEST]` wording. Sign-up requires accepting the Terms and Privacy Policy; `/account/policies` shows a
user's acceptances. The footer shows `DBID` (test mode: a `TEST-DBID-…` placeholder); the app refuses to start
in production without `DBID`. Records in `src/lib/retention.ts` are never hard-deleted.

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright; first run
`npx playwright install chromium`), `worker`, `seed`, `db:migrate`, `db:push`.
