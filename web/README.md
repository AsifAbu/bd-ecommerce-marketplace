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
  `/s/<shop slug>`. "Add to cart" is disabled until the cart (Sprint 6).
- **Delivery charge** (`src/lib/delivery.ts`, decision D9): `deliveryCharge({ insideDhaka, weightGrams })` gives
  Tk 70 inside Dhaka / Tk 130 outside for the first kg, plus Tk 20 per started kg above 1 kg (per shop order);
  `deliveryBreakdown` gives the parts.
- **Wishlist** `/account/wishlist` (logged-in; header link "Wishlist"): price, variant and "In stock" /
  "Out of stock", remove. A guest who taps **Save to wishlist** logs in and comes back to the product with
  `?wishlist=add`, and the item is saved on the server. "Move to cart" is disabled until the cart exists; the cart
  calls `wishlistService.moveToCart(userId, itemId, addToCart)` from `features/wishlist/server.ts`.
  JSON API: `GET/POST /api/wishlist`, `DELETE /api/wishlist/<itemId>`. The seed gives
  `customer.verified@ecom.test` two items (one sold out).

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

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright; first run
`npx playwright install chromium`), `worker`, `seed`, `db:migrate`, `db:push`.
