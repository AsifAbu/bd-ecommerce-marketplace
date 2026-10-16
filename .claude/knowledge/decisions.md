# Decisions log

Every decision below was made by the project owner in conversation (15–16 Oct 2026) and is reflected in plan v2.4. Change a decision only when the owner says so.

## Product decisions (D1–D15)

| # | Decision |
| --- | --- |
| D1 | Bangladesh only. BDT, Bangladesh address format (division, district, upazila/thana, area), +880 mobiles |
| D2 | Cash on delivery is the only payment method in R1. Online payments (bKash, Nagad, cards with Bangladesh Bank escrow) come later. Never Stripe |
| D3 | All UI and policy text in English for now. Bengali Terms must be added before the public launch; Bengali UI in R2 |
| D4 | No courier integration in R1. Flat delivery charges; same-day/speed promises depend on the courier, added later |
| D5 | Medicine shops must upload their drug-licence certificate; admin verifies before the shop is accepted |
| D6 | No prescription upload in v1 (in Bangladesh medicine can be bought without one). May be added later |
| D7 | Before payment, everything must be complete and standard: cart, wishlist, checkout, policies, returns |
| D8 | Testing first: dummy OTP code 123456, any test medicine certificate accepted, fake-order limits are test values (3 open COD orders per new mobile, 2 refusals block COD). Real values decided before release |
| D9 | Delivery charge per shop order: Tk 70 inside Dhaka, Tk 130 outside, + Tk 20 per kg above 1 kg (from RedX, Paperfly, eCourier rate cards) |
| D10 | Commission per category, testing values: electronics 5%, books 8%, fashion 12%, medicine 5%, other 10% |
| D11 | Shopper-visible categories grow from seller products (admin owns the full tree). Seed data: electronics parts, books, fashion + one test pharmacy |
| D12 | Guest checkout for shoppers (name, mobile verified by OTP, email, address). Same mobile/email later creates or logs in to an account; orders attach only via a verified identifier. Shop Owner, Shop Staff, Platform Admin must always log in |
| D13 | In production the platform holds COD money (courier merchant account in platform's name); shops paid within 10 days minus commission |
| D14 | Seller tiers: Basic (NID + phone OTP, ≤20 open orders, ≤100 listings) and Verified (trade licence/VAT/TIN/UBID/PRA/DBID, badge, no limits). Medicine shop = Verified + verified licence |
| D15 | Launch offer: 0% commission for the first 3 months, then category rates; featured listings later |

Also decided: 7-day returns (change of mind for fashion only; food, innerwear, perishables, medicine, digital, custom excluded); reviews from buyers only, hidden but never deleted; complaints resolved in 72 h; 48 h handover timer; 6-year records; seller beta at end of week 9; MVP test gate week 17; try-on (R3) only after traction.

## Architecture decisions (ADR-001–009)

| ADR | Decision |
| --- | --- |
| 001 | Category schema (typed attributes per leaf category) instead of free-form tags. One leaf category per product |
| 002 | Typed attribute rows as source of truth + JSONB copy for reads |
| 003 | Meilisearch for search and facet counts |
| 004 | Single database, every shop-side query scoped by `shop_id` |
| 005 | Hosted try-on API behind an adapter (self-host later if costly) |
| 006 | Try-on runs as async jobs |
| 007 | COD only in R1; payments, couriers and SMS behind adapters |
| 008 | Medicine shops gated by licence verification (`shop_licence` table, expiry job) |
| 009 | Postgres-backed job queue in R1 (no Redis) |

Stack: TypeScript, Next.js (App Router), PostgreSQL + Prisma/Drizzle, Meilisearch, S3-compatible storage, Tailwind + shadcn/ui, Auth.js/Better Auth, Zod, Vitest/Playwright, GitHub Actions, Sentry.

## Owner preferences

- Read > Think > Ask first on every prompt; ask before building or generating anything.
- Deliverable documents as MS Word files in `docs/`, with diagrams.
- Planning phase only so far: no application code yet.
