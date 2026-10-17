# Multi-Vendor E-Commerce Platform — Product Plan

Oct 15, 2026 · @Asif

## Summary

Build a multi-vendor marketplace for Bangladesh in three releases. R1 is the core marketplace with cash on delivery. R2 adds online payments, courier integration and Bengali. R3 adds virtual try-on. Try-on is the riskiest feature, so it ships last, behind a feature flag, on top of a catalog that already works.

Version 2.4 (16 Oct 2026) adds a seller-beta milestone at week 9, closes the traceability gaps between stories and use cases found by a knowledge-graph review, simplifies the R1 stack and adds a metrics dashboard. Version 2.3 adds the marketplace-growth changes from the expert review: open seller sign-up with tiers, free storefront links, an "Other" category, product matching, platform-held cash-on-delivery money, a revenue model and go-to-market targets. Version 2.2 added guest checkout. Version 2.1 merges a comparison with Daraz and Rokomari, the two largest Bangladeshi references, and the decisions made after it. The first builds are for testing: OTP uses dummy codes, test medicine certificates are accepted, and the guideline rules come from news summaries. A pre-release checklist lists what must be replaced before real customers use the site. The full comparison and its sources are in the separate doc "Product Plan vs Daraz and Rokomari".

Key recommendations:

- **The catalog is driven by a schema.** Admins define a category tree. Each leaf category carries its own typed attributes, such as Brand, Socket and Core count for Processor. Sellers fill those attributes through a form generated from the schema, and the search filters are built from the same attributes. Daraz shows the problem this avoids: its search for "processor" spans 20 categories, including food processors, and offers clothing-size and colour filters.
- **Only leaf categories hold products.** Each product belongs to exactly one leaf category, and free-form tags do not exist.
- **Shoppers see only categories that have live stock.** A category is shown to shoppers when at least one active, in-stock product sits under it. Sellers always see the full tree.
- **Bangladesh-first compliance from R1.** The plan follows the Digital Commerce Operation Guidelines 2021 and the DBID rules, as described in news coverage. That covers listing content, 48 h handover, complaints resolved within 72 h, reviews that are never deleted, a returns policy, seller payment within 10 days and 6-year records.
- **Anyone can open a shop.** Tiered seller verification: a Basic seller starts with NID and phone OTP and sells within limits; a Verified seller adds a trade licence or other registration and gets higher limits and a badge.
- **A free online store for every seller.** Each shop gets a storefront link to share on Facebook, plus CSV bulk upload, so small online sellers can move their catalogue in quickly.
- **One product page, many shops (R2).** Products are matched by ISBN or model number, so "all products in one place" shows offers from several shops instead of duplicate listings.
- **The platform collects the cash.** In production, the courier collects cash on delivery into the platform's merchant account, and shops are paid within 10 days minus commission.
- **Guest checkout for shoppers only.** Anyone can add to cart and order without an account, giving a mobile number (verified by OTP) and an email. They can later create an account, or log in to an existing one, with the same mobile or email to see their orders. Shop Owners, Shop Staff and Platform Admins must always log in.
- **Cash on delivery is the only payment method at launch.** Cart, wishlist and checkout are built to standard up to the payment step. Online payments come later.
- **Medicine shops are licence-gated.** A medicine shop is approved only after its approval certificate is verified. There is no prescription upload, by decision.
- **Try-on uses a hosted diffusion model, not template overlays.** Use a virtual try-on model behind an adapter and run it asynchronously. A pose check at upload time enforces the full-body photo rule.
- **Roles are enforced on the server and scoped per shop.** There are four roles: Platform Admin, Shop Owner, Shop Staff and Customer. Every shop-side query is filtered by `shop_id`.
- **Use a proven, boring stack with few moving parts.** TypeScript, Next.js, PostgreSQL, Meilisearch for faceted search and object storage. Background jobs run on a Postgres-backed queue, so R1 needs no Redis.

## Product brief

**Vision.** All online products in one place. The platform owner doesn't sell: anyone can open a shop and sell through the platform, and shoppers find every shop's products with clean, category-specific filters.

**Market.** Bangladesh only. Prices in BDT, Bangladesh address format, local mobile numbers. UI and policy text are in English at launch, with Bengali terms before the public launch.

**Problem.** Small and mid-size Bangladeshi shops of any type (pharmacy, bookstore, clothing, electronics) need a place to sell online without building a store themselves. Shoppers need to find the right product quickly and trust what they buy. Today they meet noisy, cross-category filters, and when buying clothes they can't tell how something will look on them.

**Personas**

| Persona | Role in system | Main job |
| --- | --- | --- |
| Platform Admin | Admin | Runs the marketplace: approves shops, verifies medicine licences, owns the category and attribute schema, publishes policies, resolves complaints |
| Shop Owner | Organization admin | Sets up and runs one shop, invites and manages staff, sees orders, returns and sales |
| Shop Staff | Shop user | Lists products, updates stock and prices, fulfils orders and handles returns for their shop |
| Customer | Normal user | Browses, searches and filters, keeps a wishlist and cart, checks out with cash on delivery, requests returns, uses try-on |

**Goals**

1. A shopper reaches a relevant product list with correct filters in 3 clicks or one search.
2. A seller can list a product correctly in under 5 minutes, guided by the form for its category.
3. Every order meets the Bangladesh guideline timings: handover within 48 h and complaints resolved within 72 h.
4. Try-on returns a believable result in under 30 seconds for supported garments.

**Non-goals (for now)**

- Online payments (bKash, Nagad, cards) in R1. Cash on delivery only.
- Courier integration and delivery-speed promises such as same day. These depend on the provider and come in R2.
- A Bengali UI in R1. Bengali terms are still needed before the public launch.
- Prescription upload for medicines (decision).
- Native mobile apps. The site is responsive and mobile-first.
- Seller-defined categories or free-form tags.
- Try-on for garments other than tops and bottoms.

**Success metrics** (targets to confirm)

| Metric | Target |
| --- | --- |
| Search-to-product-view rate | 40% or more |
| Filter usage on category pages | 25% or more of sessions |
| Seller listing completion rate | 85% or more of started listings |
| Cart-to-order rate | 30% or more of carts reaching order placement |
| Cash-on-delivery delivery success | 90% or more of orders delivered (not refused or returned) |
| Shop orders handed over within 48 h | 95% or more |
| Complaints resolved within 72 h | 95% or more |
| Active shops (at least one order in 30 days) | 100 before opening to buyers, then growing month on month |
| Live listings | 5,000 or more across the launch niches |
| Gross merchandise value (GMV) | Tracked weekly. Target set after the first month |
| Repeat buyers | 25% or more of buyers order again within 90 days |
| Seller retention | 70% or more of shops still active after 90 days |
| Try-on to add-to-cart rate | Higher than the same products without try-on (A/B test) |

## Assumptions and decisions

The decisions below were made on 15 Oct 2026 after the competitor comparison. The remaining assumptions should be confirmed before Sprint 1.

**Decisions**

| # | Decision | Effect on the plan |
| --- | --- | --- |
| D1 | Bangladesh is the only market | BDT, Bangladesh address format, Bangladesh guidelines apply |
| D2 | Cash on delivery is the only payment method in R1 | No gateway in R1. Refunds recorded and paid manually. Escrow applies once online payments arrive |
| D3 | Policy pages and UI in English for now | Bengali terms added as text before the public launch |
| D4 | Delivery speed depends on the courier, which is added later | Flat inside-Dhaka and outside-Dhaka charges set by the admin. Orders are built ready to plug a courier in |
| D5 | Medicine shops must upload their approval certificate, verified by the admin before approval | New stories US-015 and US-016, and a `shop_licence` table |
| D6 | No prescription upload in v1. In Bangladesh customers can buy medicine without a prescription. A prescription flow may be added later | Medicine is sold by verified shops only |
| D7 | Before payment, everything must be complete and standard: cart, wishlist, checkout, policies, returns | New epics: Cart and wishlist, Returns and support, Compliance |
| D8 | Build for testing first. OTP uses dummy codes, test medicine certificates are accepted, fraud limits are set for testing | A test mode, seed data and a pre-release checklist (see Testing mode and seed data) |
| D9 | Delivery charges: Tk 70 inside Dhaka and Tk 130 outside Dhaka per shop order up to 1 kg, plus Tk 20 per extra kg | Set from courier rate cards. Admin can change them |
| D10 | Commission per category, with testing values (see Delivery charges and commission) | Final rates agreed with sellers before release |
| D12 | Guest checkout for shoppers: no account needed to order. Mobile and email are required at checkout. The same mobile or email later creates an account or logs in to see the orders. Every other role must log in | New stories US-007 to US-009, and a Guest checkout section |
| D13 | In production the platform holds cash-on-delivery money: the courier collects into the platform's merchant account, and shops are paid within 10 days minus commission. In testing, collections are recorded manually | Stops commission leakage. `cod_collection` ledger in R1, courier account before release |
| D14 | Tiered sellers: Basic (NID and phone OTP, limits) and Verified (registration document, badge, higher limits) | New story US-017. Legal fit of the Basic tier checked before release |
| D15 | Launch offer: 0% commission for the first 3 months, then the category rates. Featured listings later | Attracts the first sellers |
| D11 | Shopper-visible categories grow from seller products. Test data seeds 3 niches: electronics parts, books, fashion, plus one medicine shop | The full tree stays visible to sellers |

**Assumptions**

| # | Assumption | If wrong |
| --- | --- | --- |
| A1 | One platform, many independent shops, one shared cart split into one order per shop | One shop per checkout simplifies orders |
| A2 | Shops must be approved by the Platform Admin before they can sell | Self-serve onboarding needs stronger fraud controls |
| A3 | Only the Platform Admin can create categories and attributes. Sellers can request new ones | — |
| A4 | Try-on covers tops and bottoms | Full dresses need a different model mode |
| A5 | A small team (2–3 developers) on a modest cloud budget | Changes the build-vs-buy choices |
| A6 | Variants (size, colour) carry their own stock | — |

**Open questions**

- [ ] Is there a budget for a paid try-on API, or must try-on be self-hosted?
- [ ] Final commission rates and fake-order limits (testing values are set; decide before release).

## Go-to-market and revenue

The hardest part of a marketplace is the first sellers, not the code. Buyers come where products are, so the plan targets sellers first.

### Positioning

- **For sellers:** "A free online store for your Facebook page." A shop link to share, orders and returns handled in one place, cash on delivery collected for you.
- **For shoppers:** "All online products in one place, with filters that actually work." Clean category filters, verified shops, a 7-day return policy and complaints answered within 72 hours.

### Launch plan

1. **Niches first:** electronics parts, books and fashion, where clean filters matter most. The category tree stays open for every type of product.
2. **Seller target:** 100 active shops and about 5,000 listings before opening to buyers. Seller onboarding starts at the **seller beta** (end of week 9), so shops are listing while the buyer side is still being built.
3. **Seller acquisition:** direct outreach to Facebook page sellers in the launch niches, help with CSV upload, and the 0% commission launch offer.
4. **Buyer launch:** share links from sellers' own pages bring their followers. Then search and social promotion.

### Revenue model

| Phase | Revenue |
| --- | --- |
| First 3 months | 0% commission (launch offer) |
| After launch offer | Commission per category (testing values in Delivery charges and commission) |
| Later | Featured listings and in-search ads for shops, optional paid seller tools |

Delivery charges pass through to the courier and are not a profit line.

### Money flow for cash on delivery

In production the courier collects cash on delivery into the platform's merchant account. The platform records each collection in the `cod_collection` ledger and pays the shop within 10 days, minus commission. This keeps commission from leaking and meets the 10-day seller payment rule. In testing, shops mark collections manually.

## Bangladesh market and compliance

R1 follows the Bangladesh rules that apply to an online marketplace. For testing, the timings come from news summaries of the Digital Commerce Operation Guidelines 2021 (issued 4 July 2021), mainly Bangla Tribune's item-by-item summary, plus the DBID registration guideline 2022 and the Personal Data Protection Ordinance 2025. Replace them with the official text before release (pre-release checklist).

### How the plan meets the guidelines

| Requirement | Source | How the plan meets it | Story |
| --- | --- | --- | --- |
| Listings show measurements, material, colour, quality, price, delivery charges, brand, model, delivery time, country of origin, ingredients and health or child-safety risks where relevant, images, stock, and purchase and return conditions | Guidelines 2021 | Required fields in every category schema | US-023 |
| Third-party seller's name shown on each listing. Marketplace keeps the seller's name, photo, NID, mobile and address. Seller has a trade licence, VAT registration, TIN, UBID or PRA number and displays it | Guidelines 2021 | Shop name on every product page. Owner identity and registration number collected at shop application | US-010 |
| Expired, counterfeit or adulterated goods may not be sold | Guidelines 2021 | Expiry date required for medicine and perishables. Expired items hidden automatically. Counterfeit reports | US-023, US-033 |
| Refund within 10 days of payment if a paid order is not delivered on time, by the same method | Guidelines 2021 | Not triggered in R1 (cash on delivery: nothing is paid before delivery). Applies when online payments arrive | R2 |
| Separate delivery charges per item not allowed unless delivered separately, and the customer told at confirmation or on the invoice | Guidelines 2021 | One charge per shop order, shown on the review page and invoice, because each shop ships separately | US-051 |
| Printed bill on delivery showing VAT. Warranty card for products with a warranty | Guidelines 2021 | Printable invoice per shop order, with a warranty field on listings | US-051 |
| Hand over within 48 h. Deliver within 5 days in the same city and 10 days elsewhere | Guidelines 2021 | 48 h handover timer with overdue alerts. Delivery time depends on the courier (R2) | US-053 |
| Complaints recorded and resolved within 72 h, and the customer informed. A compliance officer appointed | Guidelines 2021 | Complaint tickets with a 72 h timer and notifications. The company names a compliance officer (an organisational task) | US-072 |
| Prior consent before collecting personal data, with what is collected, where it is stored and how it is used. Cookies and special software disclosed | Guidelines 2021 | Consent checkbox at sign-up linked to the Privacy Policy, and a cookie notice | US-080 |
| Customers can rate and review. Sellers, their staff and connected people may not review. Reviews can't be deleted | Guidelines 2021 | Buyer-only reviews, blocked for members of the shop. Hidden with a logged reason, never deleted | US-055 |
| Sellers paid within 10 days after commission | Guidelines 2021 | Cash-on-delivery collections logged per shop, with a 10-day payout cycle | US-082 |
| Business records kept for 6 years | Guidelines 2021 | 6-year retention for orders, shops, complaints and audit logs | US-081 |
| Medicine sales need a drug-administration licence | Guidelines 2021 | Certificate upload and admin verification before shop approval | US-015, US-016 |
| DBID shown on the site. Terms in Bengali (other languages allowed too) | DBID guideline 2022, Guidelines 2021 | DBID in the footer. English terms for testing, Bengali added before release | US-080, US-081 |
| Advance payments held in escrow until delivery | Bangladesh Bank escrow policy | Not needed in R1 (cash on delivery). Applies when online payments arrive | R2 |
| Specific consent, purpose and retention notices, breach reports, cross-border limits | Personal Data Protection Ordinance 2025 | Privacy policy, consent records, breach runbook, try-on provider region check | US-080, US-063 |

### Policy pages (English text)

| Page | Must cover |
| --- | --- |
| Terms and Conditions | Platform role as marketplace, shop responsibilities, account rules, DBID number, governing law (Bangladesh) |
| Privacy Policy | What is collected, why, how long it is kept, who sees it, try-on photo handling, how to delete data, contact for complaints |
| Return and Refund Policy | 7-day window, eligible reasons, exclusions, condition rules, process and refund timing (below) |
| Delivery and Cash on Delivery Policy | Flat charges inside and outside Dhaka, handover within 48 h, cancellation before handover, refused deliveries |
| Seller Policy | Approval, required documents (trade licence or DBID; drug licence for medicine shops), listing rules, prohibited items, payout cycle |

Pages are versioned. Users accept the current Terms and Privacy Policy at sign-up and the Return and Delivery policies at checkout, and each acceptance is recorded.

### Return and refund policy

- **Window:** 7 days from delivery.
- **Eligible:** damaged, defective, wrong item, wrong size or colour, incomplete, or not as described. Change of mind is accepted for fashion only, unworn with tags.
- **Excluded:** food and perishables, innerwear, medicine, digital and custom-made items.
- **Process:** the customer requests a return in the app with a reason and photos. The shop accepts or rejects within 48 h, and the admin decides disputes. The item is collected or dropped off, then inspected.
- **Refund:** until online payments exist, refunds for cash-on-delivery orders are recorded and paid manually to the customer's bKash or bank account, within 7 days of the return being accepted. Delivery charges are refunded when the shop is at fault. Automated refunds come with online payments.

### Cash on delivery rules

- Phone number verified by OTP before the first order. In test mode the OTP is a fixed dummy code (see Testing mode and seed data).
- Order confirmation by SMS and email, and an email invoice listing price, delivery charge and total.
- Free cancellation until the shop hands the order over.
- Fake-order limits, testing values: a mobile number (guest or account) can hold at most 3 open cash-on-delivery orders while it has no delivered order, and 2 refused deliveries block cash on delivery for that number. The final limits are decided before release.
- Delivery charge per shop order: Tk 70 inside Dhaka, Tk 130 outside, plus Tk 20 per kg above 1 kg (decision D9). The cart shows the charge for each shop before checkout, and each shop can set a free-delivery threshold.

### Seller tiers

| Tier | Requirements | Limits and benefits |
| --- | --- | --- |
| Basic | Owner NID and photo, mobile verified by OTP, admin approval | Up to 20 open orders and 100 live listings. No badge. Can upgrade at any time |
| Verified | Basic, plus a trade licence, VAT registration, TIN, UBID, PRA or DBID number with a document | No order or listing limits. "Verified seller" badge. Ranked higher |
| Medicine shop | Verified, plus a verified drug licence | Can list in medicine categories |

The guidelines say a seller must hold one of the registration numbers. Before release, confirm whether a Basic tier is acceptable, or help Basic sellers get a DBID, which a 2022 report says can be obtained with an NID.

### Delivery charges and commission

Delivery charges are set just above typical courier rate cards, so they cover the courier and its cash-on-delivery fee. The admin can change them.

| Courier (published rate card, up to 1 kg) | Inside Dhaka | Outside Dhaka | Extra kg | Cash-on-delivery fee |
| --- | --- | --- | --- | --- |
| RedX (via a merchant's page, undated) | Tk 50 | Tk 100 | Tk 15–20 | 0% Dhaka, 1% elsewhere |
| Paperfly | Tk 70 | Tk 130 (suburb Tk 110) | Tk 20 | 0–1% |
| eCourier | Tk 80 | Tk 130 (metro), Tk 160 (thana) | Tk 30 | 1–2% |
| **Our charge to customers** | **Tk 70** | **Tk 130** | **Tk 20** | Included |

Commission is a percentage per category, deducted before the shop payout. No official Daraz Bangladesh commission table was found, so these are **testing values** to agree with sellers before release:

| Category group | Commission (testing) |
| --- | --- |
| Electronics and computer parts | 5% |
| Books | 8% |
| Fashion | 12% |
| Medicine | 5% |
| Any other category (default) | 10% |

### Medicine shops

- Choosing the Medicine shop type requires the drug licence number, expiry date and certificate document.
- The admin verifies the certificate before approving the shop. Until then the shop can't list products.
- **Testing:** any test certificate is accepted, so the flow can be tried end to end. **Production:** the admin checks the licence number, issuer, expiry and shop name against the certificate, and against the drug administration's records where available.
- Every medicine product needs an expiry date. Expired items are hidden automatically.
- The admin can block specific medicine types (for example antibiotics) from listing, and a per-product OTC flag is kept ready if rules change.
- Medicine categories accept products only from verified medicine shops.
- The system warns the shop 30 days before expiry and suspends medicine listings when the licence lapses.
- No prescription upload in v1 (decision D6). A prescription flow may be added later. Medicine is excluded from returns except for wrong, damaged or expired items.

## Testing mode and seed data

The first builds run in test mode, so every flow can be tried end to end before real providers and real sellers are connected. A pre-release checklist lists what must change before real customers use the site.

### Test mode settings

| Area | Test mode | Production |
| --- | --- | --- |
| Phone OTP | No SMS sent. The dummy code 123456 always works | Real SMS provider behind the same adapter. The app refuses to start in production if the dummy code is enabled |
| Medicine certificates | Any uploaded file is accepted, and the admin can approve it | Thorough admin verification of number, issuer, expiry and shop name |
| Fake-order limits | 3 open orders for new accounts, 2 refusals block cash on delivery, configurable | Final values decided before release |
| Guideline timings and policy text | From news summaries, English | Checked against the official text, with Bengali terms |
| Delivery and courier | Flat charges. Handover marked manually by the shop | Courier integration (R2) |
| Commission | Testing values per category | Agreed rates |
| Emails | Sent to a local mail catcher | Real email provider |

A banner on every page says "Test mode", so test data is never mistaken for real orders.

### Seed data

Shopper-visible categories grow from seller products: the admin's full tree exists from day one, but a category appears to shoppers only when an approved shop has an in-stock product in it (US-040). The seed data fills three niches so that behaviour can be tested:

| Niche | Seeded leaf categories | Seeded shop | Products |
| --- | --- | --- | --- |
| Electronics parts | Processor, RAM, Motherboard | Test Tech Shop | About 20, with full attributes for filter testing |
| Books | Fiction, Academic, Children's | Test Book Shop | About 20 |
| Fashion | Men's Shirts, Men's Pants, Women's Tops | Test Fashion Shop | About 20, with sizes and colours, some try-on eligible |
| Medicine (for the licence flow) | Pain Relief, Vitamins | Test Pharmacy, with a dummy certificate | About 10, with expiry dates |

Seeded shops cover both tiers: the Test Book Shop is Basic, the others are Verified. Seeds also include one Platform Admin, an owner and a staff user per shop, three customers (one with a verified phone, one new, one with past refusals), the delivery charges, the testing commission rates and version 1 of every policy page. Other categories in the tree stay empty, so they stay hidden from shoppers, which proves the rule.

### Pre-release checklist

- [ ] Replace guideline timings and policy text with the official Digital Commerce Operation Guidelines 2021 text, and add Bengali terms.
- [ ] Register the DBID and show it in the footer. Name a compliance officer.
- [ ] Connect the real SMS provider and disable the dummy OTP (order confirmation SMS too: the test SMS adapter only logs).
- [ ] Set the VAT rate printed on invoices (VAT_RATE_PERCENT, 0% while testing) and the launch-offer end date (COMMISSION_LAUNCH_OFFER_UNTIL).
- [ ] Switch medicine verification to the production procedure.
- [ ] Decide the final fake-order limits and commission rates.
- [ ] Remove all seed data and test accounts.
- [ ] Decide whether a prescription flow is needed.
- [ ] Confirm the Basic seller tier meets the seller-registration rule, or help Basic sellers get a DBID.
- [ ] Open the courier merchant account so the platform collects cash-on-delivery money.
- [ ] Reach 100 active shops and about 5,000 listings before opening to buyers.

## Guest checkout and accounts

A shopper can browse, fill a cart and order without creating an account. An account is only needed for the wishlist, reviews and try-on, and it can be created after the order with the same mobile or email. Shop Owners, Shop Staff and Platform Admins must always log in: the seller centre and admin areas have no guest access.

### Guest checkout flow

The flow is drawn in the figure below.

### Rules

- **Who can be a guest:** shoppers only. Every seller-centre and admin page requires a logged-in account with the right role. Shop Owners and Platform Admins are also offered two-factor login.
- **At checkout, guests give:** full name, mobile number, email and a delivery address. They also accept the Return and Delivery policies, and consent to the Privacy Policy.
- **Verification:** the mobile number is verified by OTP before the order is placed. In test mode the code is 123456. The email receives the order confirmation.
- **After the order:** an SMS and email give the order number and a tracking link. Guests can track an order with the order number plus an OTP to the same mobile.
- **New customer:** they sign up with the same mobile or email and a password. Earlier guest orders are attached automatically once that mobile or email is verified.
- **Existing customer:** if the mobile or email already belongs to an account, the checkout page offers "Log in" (password, or Forgot password). The order is attached to that account when the mobile verified at checkout matches the account. Otherwise it is kept as a guest order and attached once the account owner verifies that email.
- **Security rule:** orders join an account only through a verified identifier (mobile by OTP, or email by link). Typing someone else's email at checkout never shows their orders.
- **Login:** mobile number or email, plus a password. Password reset by email link or SMS OTP.
- **Guests can also:** request a return or raise a complaint from the tracked-order page. Wishlist, reviews and try-on need an account.
- **Cart:** a guest cart is kept on the device and merges into the account cart at login.

## Roles and permissions

There are four roles, and two of them are scoped to a single shop. A user has one personal account and profile. Roles are attached to the account: `PLATFORM_ADMIN` applies globally, while `SHOP_OWNER` and `SHOP_STAFF` are held through a membership row tying the user to a shop. Every account is a Customer by default, so a shop owner can also shop.

| Capability | Platform Admin | Shop Owner | Shop Staff | Customer |
| --- | --- | --- | --- | --- |
| Must be logged in | Always | Always | Always | Only for account features. Guests can browse, buy and track orders |
| Own profile, photo and addresses | Yes | Yes | Yes | Yes |
| Wishlist, cart, checkout, try-on | Yes | Yes | Yes | Yes |
| Manage category tree and attributes | Yes | No (can request) | No | No |
| Approve or suspend shops | Yes | No | No | No |
| Upgrade a shop from Basic to Verified | Approve | Apply | No | No |
| Share the shop's storefront link | Yes | Yes | Yes | No |
| Verify medicine licences | Yes | Upload own | No | No |
| Edit shop profile and settings | Any shop | Own shop | No | No |
| Invite or remove shop staff | Any shop | Own shop | No | No |
| Create and edit products | Any (moderation) | Own shop | Own shop | No |
| Delete products | Any | Own shop | Optional, owner-granted | No |
| Manage stock and prices | No | Own shop | Own shop | No |
| View and fulfil orders | All | Own shop | Own shop | Own orders |
| Handle returns | Decide disputes | Own shop | Own shop | Request own |
| Complaints | Resolve all | Respond for own shop | Respond for own shop | Raise own |
| Publish policies and delivery charges | Yes | No | No | No |
| View sales and payouts | All | Own shop | No | No |
| Manage users and roles | Yes | Own staff only | No | No |

Rules:

- The server checks permission on every request and never trusts the UI. Every query on shop-side data includes `shop_id = <member's shop>`. This guards against IDOR, where a user changes an ID to reach another shop's data.
- Admin actions such as suspending a shop, verifying a licence or hiding a review are written to an audit log.
- At the MVP, Shop Staff get a fixed permission set. Later the owner can toggle permissions per staff member.

## Categories, attributes and dynamic filters

One schema per leaf category drives three things: the seller's form, the stored product data and the shopper's filters. The filter panel is built from the schema and the matching products, so it can only show attributes that belong to that category.

&#91;embedded content: schema-driven catalog · one schema, five stages\]

The seller form, the server check and the filter panel all read the same schema, so a Processor page cannot show a Book filter.

### Category tree

- Categories form a tree, for example Electronics → Computer Components → Processor, or Fashion → Men → Pants.
- **A product attaches to exactly one leaf category.** Parent categories exist only for navigation.
- Only the Platform Admin edits the tree. Sellers can send a "request new category" form, which the admin answers within 24 hours.
- Each parent category has an **"Other" leaf** with only the common fields, so a seller is never blocked. "Other" shows only the common filters (price, rating, shop), and the admin moves products to a proper category when one is created.

### Attribute definitions

Each attribute is defined once, then assigned to the categories that use it, so "Brand" is a single attribute shared by many categories. The assignment carries category-specific settings.

| Field | Purpose | Example (Processor) |
| --- | --- | --- |
| `name` and `key` | Display label and stable key | Socket / `socket` |
| `type` | `enum`, `multi_enum`, `number`, `boolean` or `text` | `enum` |
| `options` | Allowed values for enum types | AM5, LGA1700, LGA1851 |
| `unit` | For numbers | GHz |
| `required` | The seller must fill it | true |
| `filterable` | Appears in the filter panel | true |
| `filter_widget` | checkbox list, range slider or toggle | checkbox list |
| `display_order` | Order in the form and the filter panel | 2 |
| `is_variant_axis` | Varies per SKU rather than per product (size, colour) | false |

Example schemas:

| Category | Attributes (filterable ones in **bold**) |
| --- | --- |
| Processor | **Brand**, **Socket**, **Core count**, **Base clock (GHz)**, **TDP (W)**, **Integrated graphics**, Model number |
| Books | **Author**, **Language**, **Format** (hardcover, paperback, ebook), **Genre**, ISBN, Page count |
| Medicine (verified shops only) | **Brand**, **Generic name**, **Dosage form** (tablet, syrup), **Strength (mg)**, Pack size, OTC flag |
| Men's Pants | **Brand**, **Fit**, **Material**, **Size** (variant), **Colour** (variant), **Try-on eligible** |

### Required listing fields (Bangladesh guidelines)

Every category schema includes these fields, so no listing can go live without them: quantity or unit, weight (for the delivery charge), brand, model where relevant, country of origin, ingredients or materials where relevant, price, images, stock, return eligibility (eligible, change-of-mind eligible, or excluded), and warranty where offered. Medicine and perishables also need an expiry date. The shop's name and the delivery charge are shown automatically. Medicine categories also require the shop's licence to be verified.

### Seller listing flow

1. The seller picks a leaf category, either by search ("processor") or by walking the full tree. **The full tree is always shown to sellers.**
2. The form renders from that category's attributes. Required fields are enforced, enum fields become dropdowns that block free text, and number fields take units.
3. The server validates the payload against the same schema, using a Zod schema generated from the attribute definitions. Unknown attributes are rejected.
4. If an enum option is missing (a new brand, say), the seller requests it. It stays pending until an admin approves it. This keeps the filters free of variants like "AMD", "amd" and "A.M.D".

### How filters are generated

1. The shopper opens a category or searches "processor". Search resolves the query to the best-matching leaf category, and the results page is scoped to it.
2. The search engine runs one query that returns the matching products **and facet counts** for every `filterable` attribute of that category.
3. The filter panel renders those facets in `display_order`. Options with 0 results are hidden or greyed out. A range slider takes its bounds from the min and max of the results.
4. Choosing a filter re-runs the query, the facet counts update, and the selection goes into the URL (`/c/processor?brand=amd&socket=am5`) so it can be shared and indexed by search engines.
5. If a free-text search spans several categories ("usb"), the page shows only the common filters (price, rating, shop), plus a "Narrow by category" list. Category-specific filters appear once a category is picked.

### What shoppers see in the category list

A category is shown to shoppers only when it has at least one active, in-stock product in it or under it, from any approved shop. Each category stores a `live_product_count`. A background job updates it whenever a product is created, deleted or goes out of stock, and navigation reads that count rather than counting on every request.

### Schema changes

- Adding an optional attribute is safe, because existing products simply have no value for it.
- Adding a *required* attribute marks existing products "needs update" and notifies their sellers. They stay visible.
- Renaming or merging enum options runs a migration job that rewrites product values and re-indexes them.
- Attributes are archived, never hard-deleted.

## Virtual try-on

The recommendation is an image-based virtual try-on model, called asynchronously, with a pose check when the user uploads a photo. Your "template photo" idea is kept in a better form: the seller uploads one clean garment image, and the model fits it to the user's photo. Start R3 only after the marketplace shows traction, for example 100 active shops and steady weekly orders.

### Options compared

| Option | How it works | Realism | Cost and effort | Verdict |
| --- | --- | --- | --- | --- |
| A. 2D template overlay | The seller provides a cut-out garment PNG. The app scales it and warps it onto the body using pose keypoints | Low. It ignores body shape, arm position, folds and lighting, so it looks pasted on | Cheap, runs in the browser, but fiddly per garment | Prototype only |
| B. Hosted try-on API | Send the person photo and the garment image to a commercial try-on API (FASHN, Google Vertex AI virtual try-on, or similar) | High | Pay per image, little ML work, fastest to ship | **Recommended for R3** |
| C. Self-hosted open model | Run an open diffusion try-on model (IDM-VTON, CatVTON, OOTDiffusion or similar) on a GPU worker | High, and tunable | GPU hosting plus ML ops. Check each model's licence: several are non-commercial | Move here later if API costs grow |
| D. 3D avatar | Build a 3D body from the photo and simulate the cloth | Highest in theory | Needs 3D garment models per product. Not realistic for a marketplace | Not recommended |

Provider names and licences need checking in a one-week spike before committing. The comparison is from general knowledge and was not looked up for this doc.

### What each side provides

- **Seller, at listing time:** for a try-on-eligible category (tops, bottoms), one extra **garment image**: front view, flat-lay or ghost mannequin, plain background. The form shows an example and blocks upload if the image fails basic checks (resolution ≥ 768 px, garment detected). The seller also marks the garment type as `upper` or `lower`, which the model needs.
- **Customer, in the profile:** one or more **try-on photos**. These are separate from the avatar.

### Photo validation (full body, head to feet)

Validation runs at upload time, so the user gets feedback straight away rather than after clicking Try on:

1. Basic checks: image type (JPEG, PNG, WebP), size ≤ 10 MB and resolution ≥ 768 × 1024. Then strip EXIF data, which can include GPS location.
2. Pose check with a pose-landmark model (MediaPipe Pose, for example), run in the browser for instant feedback and again on the server. It requires exactly one person, with nose, both shoulders, both hips, both knees and both ankles all detected above a confidence threshold, and the person must fill at least about 50% of the image height.
3. The photo is saved with a status of `valid_full_body` or `invalid`, plus a reason.
4. Clicking **Try on** with no valid photo shows: "Please upload a full-length photo (head to feet) to use Try on", with a link to upload one.

### Try-on flow

1. The customer clicks Try on for an eligible product. The server checks the photo is valid and the garment image exists.
2. A cached result for this photo and garment pair is returned straight away.
3. Otherwise a job is queued. The UI shows a progress state, and the result arrives by polling or a server-sent event.
4. The worker calls the try-on provider with the person image, the garment image and the garment type, and stores the result in private storage.
5. The result is shown next to the product photos with a note that it is an AI preview. The user can save or delete it.

Usage is rate-limited per user, for example 20 try-ons a day, to control cost.

### Privacy (body photos are sensitive)

- Ask for explicit, specific consent before the first upload, and say why the photo is collected, who processes it and how long it is kept, as the Personal Data Protection Ordinance 2025 requires.
- Keep photos in a private bucket and serve them only through short-lived signed URLs. They are never public.
- Choose a provider that does not keep or train on uploaded images, and that processes them in a region allowed for cross-border transfer. Otherwise self-host.
- The user can delete their photos and results at any time. Results are deleted automatically after 30 days.
- Never show try-on photos to sellers or admins in normal admin views.
- Test local garments (saree, salwar kameez, panjabi) in the try-on spike, because loose garments may fail.

## Epics and user stories

The plan has 55 stories in 10 epics. Version 2.4 adds a metrics dashboard (US-083) and marks two Should stories as stretch goals. Version 2.2 added guest checkout (US-007 to US-009). Version 2.3 adds seller tiers, storefronts, the "Other" category, Bengali search, product matching, cart delivery charges and seller scores. Version 2 adds the Cart and wishlist, Returns and support, and Compliance epics, the medicine-licence stories and phone verification, and makes reviews a Must. Full acceptance criteria are written below for the highest-risk stories.

| ID | Epic | Story | Priority |
| --- | --- | --- | --- |
| US-001 | Accounts | As a visitor, I want to sign up with my mobile number or email and a password (Google optional) so that I can see my orders and use the wishlist | Must |
| US-002 | Accounts | As any user, I want to edit my profile (name, phone, avatar) so that my details are correct | Must |
| US-003 | Accounts | As any user, I want to log in with my mobile or email and a password, and reset it by email link or SMS OTP, so that my account is secure | Must |
| US-004 | Accounts | As a Platform Admin, I want to view, suspend and change the roles of users so that I can keep the platform safe | Must |
| US-005 | Accounts | As a customer, I want to verify my mobile number by OTP (dummy code in test mode) so that I can place cash-on-delivery orders | Must |
| US-006 | Accounts | As a customer, I want to save addresses in Bangladesh format (division, district, upazila or thana, area) so that checkout is quick and accurate | Must |
| US-007 | Accounts | As a guest shopper, I want to check out without an account by giving my name, mobile (verified by OTP), email and address so that I can order quickly | Must |
| US-008 | Accounts | As a guest shopper, I want to track my order with the order number and an OTP to my mobile so that I know its status without an account | Must |
| US-009 | Accounts | As a customer, I want my earlier guest orders attached when I sign up or log in with the same verified mobile or email so that all my orders are in one place | Must |
| US-010 | Shops | As a customer, I want to apply to open a shop (name, type, owner NID and photo, and a trade licence, VAT, TIN, UBID or PRA number) so that I can sell | Must |
| US-011 | Shops | As a Platform Admin, I want to approve, reject or suspend shops so that only legitimate sellers operate | Must |
| US-012 | Shops | As a Shop Owner, I want to edit my shop profile (logo, banner, policies) so that customers trust my shop | Must |
| US-013 | Shops | As a Shop Owner, I want to invite staff by email and remove them so that my team can help run the shop | Must |
| US-014 | Shops | As a Shop Owner, I want a storefront page with my own link to share on Facebook, and as a shopper I want to browse one shop's products, so that sellers bring their followers | Must |
| US-015 | Shops | As an owner applying for a Medicine shop, I want to upload my drug licence certificate so that the admin can verify and approve my shop | Must |
| US-016 | Shops | As a Platform Admin, I want to verify medicine licences and be alerted before they expire so that only licensed shops sell medicine | Must |
| US-017 | Shops | As a Shop Owner, I want to start as a Basic seller with my NID and phone, and upgrade to Verified with a registration document, so that I can start selling quickly | Must |
| US-020 | Catalog schema | As a Platform Admin, I want to manage the category tree so that products are organised consistently | Must |
| US-021 | Catalog schema | As a Platform Admin, I want to define attributes and assign them to leaf categories so that each category has the right fields and filters | Must |
| US-022 | Catalog schema | As a seller, I want to request a new category or enum option and get an answer within 24 hours so that I can list items that don't fit yet | Must |
| US-023 | Catalog schema | As a Platform Admin, I want the guideline fields (quantity, ingredients, delivery charge, return eligibility) required in every schema so that listings are compliant | Must |
| US-024 | Catalog schema | As a seller, I want an "Other" leaf under each parent category so that I can list a product before its exact category exists | Must |
| US-030 | Listings | As shop staff, I want to create a product in one leaf category through a form generated for it so that my listing is complete and filterable | Must |
| US-031 | Listings | As shop staff, I want to add variants (size, colour) with their own stock and price so that customers can pick the right one | Must |
| US-032 | Listings | As shop staff, I want to upload product images so that customers can see the product | Must |
| US-033 | Listings | As shop staff, I want to edit, deactivate or delete products and update stock so that the catalog stays accurate | Must |
| US-034 | Listings | As shop staff, I want to bulk-import products from a CSV template for one category, with row-by-row errors, so that I can move my catalogue in quickly | Must |
| US-040 | Discovery | As a customer, I want to see only categories that have products so that I never land on an empty page | Must |
| US-041 | Discovery | As a customer, I want to search products by keyword so that I find what I need | Must |
| US-042 | Discovery | As a customer, I want filters that match the category I'm browsing so that I can narrow results precisely | Must |
| US-043 | Discovery | As a customer, I want to sort by price, newest and rating so that I can compare | Should |
| US-044 | Discovery | As a customer, I want a product detail page with specs, images, variants, delivery charge, return eligibility and shop info so that I can decide | Must |
| US-045 | Discovery | As a customer, I want search to understand Bengali and Banglish spellings (for example "sharee", "boi") so that I find products the way I type | Should (stretch: R1 if time allows, else first in R2) |
| US-046 | Discovery | As a customer, I want one product page showing offers from every shop that sells it (matched by ISBN or model number) so that I can compare price and delivery | Should (R2) |
| US-050 | Cart and wishlist | As a customer, I want to add items from several shops to one cart, grouped by shop, so that I can buy together | Must |
| US-051 | Cart and wishlist | As a customer, I want to check out with a saved address and cash on delivery, and see every charge before I confirm, so that I can complete my purchase | Must |
| US-052 | Cart and wishlist | As a customer, I want to see my order history and status so that I can track deliveries | Must |
| US-056 | Cart and wishlist | As a customer, I want to change quantities, remove items and save items for later, with prices and stock re-checked, so that my cart stays accurate | Must |
| US-057 | Cart and wishlist | As a customer, I want a wishlist I can add to, remove from and move items into my cart so that I can buy later | Must |
| US-058 | Cart and wishlist | As a customer, I want to see the delivery charge for each shop in my cart, and any free-delivery threshold, before checkout so that there are no surprises | Must |
| US-059 | Orders | As a shopper, I want to see each shop's performance score (handover speed, refusal and return rates, rating) so that I can trust who I buy from | Should (stretch: R1 if time allows, else first in R2) |
| US-053 | Orders | As shop staff, I want to confirm, pack and hand over orders within 48 h, with overdue alerts, so that I meet the delivery rules | Must |
| US-054 | Orders | As a Shop Owner, I want to see sales, cash-on-delivery collections and payout reports so that I know how my shop is doing | Should |
| US-055 | Orders | As a customer, I want to rate and review a delivered product, with shop members blocked from reviewing their own shop, so that others can benefit | Must |
| US-070 | Returns and support | As a customer, I want to request a return within 7 days with a reason and photos so that I can get a refund | Must |
| US-071 | Returns and support | As shop staff, I want to accept or reject return requests within 48 h, and record the refund, so that returns are handled on time | Must |
| US-072 | Returns and support | As a customer, I want to raise a complaint and have it resolved within 72 h so that problems are fixed | Must |
| US-080 | Compliance | As a Platform Admin, I want to publish versioned policy pages and record user acceptance so that terms are disclosed and provable | Must |
| US-081 | Compliance | As a Platform Admin, I want the DBID shown in the footer and records kept for 6 years so that the platform meets the registration and record rules | Must |
| US-082 | Compliance | As a Platform Admin, I want cash-on-delivery collections logged per shop with a 10-day payout cycle so that sellers are paid on time | Must |
| US-083 | Compliance | As a Platform Admin, I want a dashboard of active shops, live listings, GMV, repeat buyers, refusal rate and seller retention so that I can track the marketplace metrics | Should |
| US-060 | Try-on | As a customer, I want to upload a full-body photo with instant validation so that I can use Try on | Should |
| US-061 | Try-on | As shop staff, I want to upload a garment image for apparel products so that they become try-on eligible | Should |
| US-062 | Try-on | As a customer, I want to click Try on and see the garment on my photo so that I know how it looks on me | Should |
| US-063 | Try-on | As a customer, I want to delete my try-on photos and results so that I control my data | Must (with try-on) |

### Traceability to use cases

Every story now maps to at least one use case in the use case diagrams document. A knowledge-graph review of version 2.3 found seven stories with no use case; version 2.4 adds them:

| Story | New use case | Actor | Relationship |
| --- | --- | --- | --- |
| US-024 "Other" leaf | UC-43 List in "Other" category | Shop Staff | Extends Add product |
| US-043 Sort | UC-44 Sort search results | Guest shopper | Extends Search products |
| US-045 Bengali and Banglish search | UC-45 Search in Bengali or Banglish | Guest shopper | Extends Search products |
| US-046 Product matching | UC-46 Compare offers from several shops (R2) | Guest shopper | Extends View product details |
| US-058 Delivery charge per shop | UC-47 See delivery charge per shop | Guest shopper | Included in Manage cart |
| US-059 Shop performance score | UC-48 View shop performance score | Guest shopper | Extends View shop storefront |
| US-063 Delete try-on data | UC-49 Delete try-on photos and results | Customer | — |
| US-083 Metrics dashboard | UC-50 View marketplace metrics | Platform Admin | — |

### Acceptance criteria for the highest-risk stories

**US-015 and US-016 Medicine shop verification**

- Given I choose the Medicine shop type, when I submit the application without a licence number, expiry date and certificate file, then the submission is blocked.
- Given test mode, when I upload any file as the certificate, then the admin can approve it, so the flow can be tested.
- Given my medicine shop is pending, when I try to create a product, then the request is rejected until the admin verifies the licence.
- Given the admin rejects my certificate, when I open my application, then I see the reason and can upload a new one.
- Given a verified licence expires in 30 days, when the daily job runs, then the shop owner and the admin are notified.
- Given the licence has expired, when the job runs, then the shop's medicine listings are hidden until a new certificate is verified.
- Given a non-medicine shop, when its staff try to list in a medicine category, then the request is rejected.

**US-030 Create product through the category form**

- Given I am shop staff and pick the leaf category "Processor", when the form loads, then it shows exactly the attributes assigned to Processor plus the required guideline fields, in display order.
- Given a required attribute is empty, when I submit, then the save is blocked and the field shows an error.
- Given I send an attribute that does not belong to Processor, through the API directly, when the server validates it, then the request is rejected with a 422 and the attribute named.
- Given I pick a non-leaf category, when I submit, then the request is rejected.
- Given I am staff of shop A, when I try to create a product for shop B, then the request is rejected with a 403.

**US-042 Dynamic filters**

- Given I am on Processor results, when the filter panel renders, then it shows only Processor's filterable attributes plus the common ones (price, rating, shop).
- Given I select Brand = AMD, when results update, then the other facets show counts within the AMD results, and options with 0 results are hidden or disabled.
- Given I copy the URL with filters applied, when someone opens it, then they see the same results and filter state.
- Given my search spans several categories, when results render, then only common filters and a "Narrow by category" list appear.

**US-007 to US-009 Guest checkout and account linking**

- Given I am not logged in, when I check out, then I must give name, mobile, email and address and verify the mobile by OTP before placing the order.
- Given my mobile matches an existing account, when I reach checkout, then I am offered Log in, and if I continue, the order is attached to that account because the mobile was verified.
- Given I placed a guest order, when I enter the order number and the OTP sent to my mobile, then I see the order status, and can request a return or raise a complaint.
- Given I later sign up with the same mobile and verify it, when my account is created, then all guest orders with that mobile appear in My orders.
- Given someone types my email at checkout but verifies a different mobile, when they place the order, then it is not attached to my account until I verify that email myself.
- Given I forgot my password, when I choose Forgot password, then I can reset it by email link or SMS OTP, and see my orders after logging in.
- Given I am not logged in, when I open any seller-centre or admin page, then I am sent to the login page.

**US-050 and US-056 Cart**

- Given I add items from two shops, when I open the cart, then items are grouped by shop with a subtotal and delivery charge for each.
- Given a variant has 3 in stock, when I set quantity to 5, then the quantity is capped at 3 with a message.
- Given a price changed since I added the item, when I open the cart or checkout, then I see the new price and a notice before I can continue.
- Given I added items as a guest, when I log in, then the guest cart merges into my account cart.
- Given I choose Save for later, when the cart reloads, then the item moves out of the totals into a saved list.

**US-051 Checkout with cash on delivery**

- Given my phone is not verified, when I reach checkout, then I must complete the OTP before placing the order. In test mode the code 123456 is accepted.
- Given my address is outside Dhaka, when the review page loads, then each shop order shows the outside-Dhaka delivery charge and the total.
- Given I have not accepted the current Return and Delivery policies, when I place the order, then the order is blocked until I accept.
- Given I place an order with items from two shops, when it is confirmed, then two shop orders are created, and I receive one SMS and one email invoice listing all charges.
- Given I am a new account with 3 open cash-on-delivery orders, when I try a fourth, then I see the limit message.

**US-057 Wishlist**

- Given I am a guest, when I tap the wishlist icon, then I am asked to log in and the item is saved after login.
- Given an item in my wishlist, when I move it to the cart, then it appears in the cart with a variant chosen and is removed from the wishlist.
- Given a wishlisted item goes out of stock, when I open the wishlist, then it shows Out of stock and can't be moved to the cart.

**US-070 and US-071 Returns**

- Given my order was delivered 8 days ago, when I request a return, then the request is blocked with the 7-day policy message.
- Given a medicine item that is not damaged or wrong, when I request a return, then the request is blocked with the exclusion reason.
- Given a valid return request, when the shop has not responded in 48 h, then it is escalated to the admin.
- Given a return is accepted, when the refund is paid manually, then the shop records the method and reference, and I am notified.

**US-062 Try on**

- Given I have no valid full-body photo, when I click Try on, then I see the upload prompt and no job is created.
- Given a valid photo and an eligible top, when I click Try on, then I see progress and a result within 30 s at p90, labelled as an AI preview.
- Given the provider fails or times out, when the job ends, then I see "Try on is unavailable right now" and am not charged against my daily limit.

## Prioritisation and MVP

The MVP proves the core loop for Bangladesh: approved shops list products through category forms, customers find them with correct filters, keep a wishlist and cart, and place a cash-on-delivery order. Returns, complaints and the policy pages are part of the MVP because the guidelines require them.

| Release | Scope | Stories |
| --- | --- | --- |
| R1 — MVP (Bangladesh, cash on delivery) | Accounts with phone OTP and Bangladesh addresses, guest checkout and order tracking, Basic and Verified sellers, storefront links, CSV upload, "Other" categories, Bengali-tolerant search, seller scores, shop onboarding with medicine-licence verification, category schema with guideline fields, schema-driven listings, search with dynamic filters, product page, wishlist, multi-shop cart, checkout up to payment with cash on delivery, order lifecycle with 48 h handover, reviews, returns, complaints, policy pages, compliance records | US-001–009, 010–017, 020–024, 030–034, 040–042, 044, 045, 050–053, 055–059, 070–072, 080–083. US-045 and US-059 are stretch goals |
| R2 — Payments, delivery and Bengali | bKash, Nagad and cards through an escrow-compliant gateway, courier integration and delivery estimates, Bengali UI, listing review and "Verified brand" badge, "report listing", product matching (offers from several shops), sorting, sales reports, vouchers | US-043, 046, 054, plus payment, courier and Bengali UI stories to write |
| R3 — Try-on (after traction) | Try-on photo upload and validation, garment images, try-on generation, data controls. Starts once the marketplace shows traction | US-060–063 |
| Later | Featured listings and ads, a consolidation hub for multi-shop orders, per-staff permissions, recommendations, pre-orders, native apps | — |

**Won't do now:** online payments in R1, prescription upload, multi-currency, live chat between buyer and seller, and seller-defined tags.

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | Core Web Vitals at p75: LCP < 2.5 s, INP < 200 ms, CLS < 0.1, on mid-range Android phones over 4G. Search and filter API p95 < 300 ms. Product page server render p95 < 500 ms |
| Try-on latency | p90 < 30 s end to end. The UI never blocks while it runs |
| Scale (initial) | 1,000 shops, 100,000 products and 200 concurrent users without redesign |
| Security | OWASP Top 10 and ASVS level 2 practices. Role and shop-scoped authorisation on every endpoint. Rate limits on auth, OTP, search, checkout and try-on |
| Compliance | Digital Commerce Operation Guidelines 2021: required listing fields, 48 h handover timer, 72 h complaint timer, reviews never deleted, 10-day seller payout cycle, 6-year record retention. DBID in the site footer |
| Privacy | Personal Data Protection Ordinance 2025: specific consent with purpose and retention notices, consent records, a breach runbook with prompt reporting to the national data authority, cross-border transfer checks for any third-party processor. Try-on photos private, EXIF stripped, results deleted after 30 days |
| Payments | R1: cash on delivery only, so no payment data is stored. Later: hosted payment pages of an escrow-compliant local gateway, so no card or wallet credentials touch our servers |
| Localisation | English UI and policy text at launch. Bengali Terms before the public launch, Bengali UI in R2. From R1, products can carry an optional Bengali name and search accepts Bengali and Banglish spellings. BDT prices, Bangladesh address format, +880 mobile numbers validated as 11 digits starting 01 |
| Accessibility | WCAG 2.2 AA. The filter panel, cart and checkout work by keyboard, and the try-on result has alt text and an announced status |
| SEO | Server-rendered category and product pages, clean filter URLs, canonical tags on filter combinations, sitemap, Product structured data |
| Reliability | 99.5% uptime target. Daily database backups with 7-day point-in-time recovery. RPO 24 h or less, RTO 4 h or less. Try-on failures degrade gracefully |
| Observability | Structured logs, error tracking (Sentry), uptime checks, and alerts on 5xx rate, search latency, overdue handovers, overdue complaints and try-on failure rate |
| Devices | Mobile-first and responsive. The last 2 versions of Chrome, Safari, Firefox and Edge |

## Tech stack and decisions

The recommendation is a TypeScript full-stack app on Next.js and PostgreSQL, with Meilisearch for faceted search and a separate worker for try-on jobs. Exact versions are pinned in Sprint 0 from the current stable releases; they were not looked up for this doc.

### Application framework

| Option | Fit for this app | Learning curve | Cost and hosting | Verdict |
| --- | --- | --- | --- | --- |
| **Next.js (App Router) + TypeScript** | Server-rendered category and product pages for SEO, one language end to end, large ecosystem | Moderate | Vercel, or a container on any cloud | **Chosen** |
| NestJS API + React SPA | Clean API boundary, but SEO needs extra work and there are two apps to deploy | Moderate to high | Two services | Fallback if a separate mobile app is planned soon |
| Laravel or Django monolith | Mature admin and auth, fast CRUD | Low if the team knows it | Cheap | Good if the team already knows PHP or Python |

### Faceted search

| Option | Facets | Ops effort | Verdict |
| --- | --- | --- | --- |
| PostgreSQL only (JSONB + GIN indexes) | Possible, but facet counts get slow and complex as the catalog grows | None extra | Fine for a prototype |
| **Meilisearch** | Built-in facet counts and filters, typo-tolerant search | Low: one service, or the managed cloud | **Chosen for R1** |
| OpenSearch or Elasticsearch | Most powerful aggregations | High | Move here if past about 5M products or if complex ranking is needed |

### Rest of the stack

| Concern | Choice |
| --- | --- |
| Database | PostgreSQL with Prisma or Drizzle ORM |
| Product attribute storage | Typed `product_attribute_value` rows as the source of truth, plus a denormalised JSONB copy on the product for fast reads (ADR-002) |
| Auth | Auth.js (NextAuth) or Better Auth: email and password plus Google, with phone OTP for cash on delivery. Sessions in an httpOnly cookie |
| SMS | A local Bangladeshi SMS gateway for OTP and order confirmations, behind an adapter |
| Validation | Zod, with schemas generated from category attribute definitions |
| UI | Tailwind CSS with shadcn/ui components |
| Files | S3-compatible object storage with a CDN. Separate private buckets for try-on photos, licence certificates and return photos |
| Jobs | A Postgres-backed queue (pg-boss or similar) for search indexing, category counts, handover and complaint timers, licence-expiry checks, SMS and email. Add Redis only if try-on or load needs it (ADR-009) |
| Try-on | Hosted try-on API behind an adapter interface, so it can later swap to a self-hosted model |
| Pose check | MediaPipe Pose: the web build in the browser and the server build |
| Payments (R2) | bKash, Nagad and cards through an escrow-compliant local gateway, behind an adapter. R1 is cash on delivery only |
| Courier (R2) | Courier provider API behind an adapter. R1 uses flat delivery charges |
| Testing | Vitest, Testing Library, Playwright |
| CI/CD | GitHub Actions: lint, typecheck, tests, preview deploys |
| Monitoring | Sentry, plus the host's logs and uptime checks |

### Architecture Decision Records

| ADR | Decision | Why | Consequence |
| --- | --- | --- | --- |
| ADR-001 | Category schema (EAV-lite) over free-form tags | Guarantees correct, category-specific filters | Admins must curate the schema, and sellers can't invent fields |
| ADR-002 | Typed attribute rows plus a JSONB copy | Integrity and validation from the rows, fast reads and indexing from the JSONB | Both must be written in one transaction |
| ADR-003 | Meilisearch for search and facets | Facet counts out of the box, low ops | One more service, and index sync jobs to maintain |
| ADR-004 | Single tenant database with `shop_id` scoping | Simple, cross-shop search is easy | Every query must be scoped, enforced in a data-access layer and covered by tests |
| ADR-005 | Hosted try-on API behind an adapter | Ships fastest and avoids GPU ops | Cost per image and a third party handles body photos, which needs a DPA and a region check |
| ADR-006 | Asynchronous try-on jobs | Generation takes seconds, and HTTP requests shouldn't block | Needs a queue, a worker and result polling |
| ADR-007 | Cash on delivery only in R1, with payment and courier adapters | Matches the market, avoids escrow and KYC work in R1 | Manual refunds and payouts until R2. Fake-order controls needed |
| ADR-008 | Medicine shops gated by licence verification | The guidelines require a drug-administration licence | A `shop_licence` table, admin review queue and expiry job |
| ADR-009 | Postgres-backed job queue instead of Redis in R1 | One fewer service to run and monitor for a 2–3 person team; R1 job volume is small | Revisit when try-on jobs or traffic need Redis |

## Architecture

One Next.js app serves pages and the API. PostgreSQL is the source of truth, Meilisearch serves search and facets, and a background worker handles indexing, counts and try-on jobs.

&#91;embedded content: system architecture · 7 components, 1 external\]

Requests never wait on slow work: indexing, category counts and try-on generation go through the queue to the worker.

### Data model (key tables)

| Table | Key fields | Notes |
| --- | --- | --- |
| `user` | id, email (unique), email_verified_at, phone (unique), phone_verified_at, password_hash, name, avatar_url, is_platform_admin, status | Login by mobile or email |
| `address` | id, user_id, name, phone, division, district, upazila, area, line1, is_default | Bangladesh format |
| `shop` | id, name, slug, type, logo_url, registration_type (`trade_licence`, `vat`, `tin`, `ubid`, `pra`), registration_no, owner_nid, owner_photo_key, tier (`basic`, `verified`), storefront_slug, free_delivery_threshold, performance_score, status (`pending`, `approved`, `suspended`), owner_id | Seller identity kept as the guidelines require |
| `shop_licence` | id, shop_id, licence_no, expiry_date, document_key, status (`pending`, `verified`, `rejected`, `expired`), reviewed_by, reviewed_at, reason | Medicine shops. Private bucket |
| `shop_member` | shop_id, user_id, role (`owner`, `staff`), permissions JSONB | Unique on (shop_id, user_id) |
| `category` | id, parent_id, name, slug, is_leaf, is_other, requires_licence, requires_expiry, commission_rate, live_product_count, path | Commission per category |
| `attribute` | id, key, name, type, unit | Defined once globally |
| `attribute_option` | id, attribute_id, value, label, status (`active`, `pending`) | Values for enum attributes |
| `category_attribute` | category_id, attribute_id, required, filterable, filter_widget, display_order, is_variant_axis | Assignment with category-specific settings |
| `product` | id, shop_id, category_id (leaf only), title, slug, description, status, attributes JSONB, name_bn, catalog_item_id, brand, model, country_of_origin, warranty, return_eligibility, tryon_type | Index on (category_id, status) |
| `product_attribute_value` | product_id, attribute_id, option_id or value_number or value_text | Typed source of truth |
| `product_variant` | id, product_id, sku, price, stock, weight_g, expiry_date, variant_attrs JSONB | Expired variants hidden by a daily job |
| `product_image` | id, product_id, url, kind (`gallery`, `garment`), position | `garment` is the try-on input |
| `catalog_item` | id, category_id, identifier_type (`isbn`, `model_no`), identifier, canonical_title | Groups the same product from many shops (R2 matching; field added in R1) |
| `category_request` | id, shop_id, parent_id, name, reason, status, due_at (24 h) | Answered within 24 hours |
| `wishlist_item` | user_id, product_id, created_at | Unique on (user_id, product_id) |
| `cart_item` | user_id or guest_token, variant_id, qty, saved_for_later, price_at_add | Guest cart merges at login |
| `delivery_rate` | zone (`inside_dhaka`, `outside_dhaka`), base_amount (1 kg), extra_per_kg, effective_from | Tk 70 / Tk 130, plus Tk 20 per kg |
| `order` | id, order_no, user_id (null for guests), contact_name, contact_phone, phone_verified_at, contact_email, status, total, payment_method (`cod`), address snapshot, policy_versions | Guest orders attach to an account through a verified phone or email |
| `shop_order` | id, order_id, shop_id, status, subtotal, delivery_charge, handover_due_at, cancel_reason | Split by shop for fulfilment |
| `order_item` | shop_order_id, variant_id, qty, unit_price, title snapshot | |
| `cod_collection` | shop_order_id, amount, collected_at, payout_due_at, paid_out_at | 10-day payout cycle |
| `review` | id, product_id, user_id, order_item_id, rating, text, status (`visible`, `hidden`), hidden_reason | Never deleted |
| `return_request` | id, order_item_id, reason, photos, status, shop_due_at, refund_amount, refund_method, refund_reference, refunded_at | 7-day window |
| `complaint_ticket` | id, user_id, order_id, subject, status, due_at, resolved_at | 72 h timer |
| `policy_document` | id, type, version, body, published_at | Versioned text |
| `policy_acceptance` | user_id, policy_id, version, context (`signup`, `checkout`), accepted_at | Proof of acceptance |
| `tryon_photo` | id, user_id, storage_key, status (`valid_full_body`, `invalid`), reason, consent_at | Private bucket |
| `tryon_result` | id, user_id, photo_id, product_id, status, storage_key, expires_at | Cache key is (photo_id, product_id) |
| `audit_log` | id, actor_id, action, entity, entity_id, data, at | Kept 6 years |

### API surface

| Area | Endpoints | Who |
| --- | --- | --- |
| Auth and profile | `POST /auth/register`, `POST /auth/login` (mobile or email), `POST /auth/forgot-password`, `POST /otp/send`, `POST /otp/verify`, `POST /me/phone/otp`, `GET/PATCH /me`, `/me/addresses`, `GET /geo/divisions`, `/geo/districts`, `/geo/upazilas` | Any signed-in user |
| Catalog (public) | `GET /s/:storefrontSlug` (shop storefront), `GET /categories?visible=true`, `GET /search?q=&category=&filters=&sort=&page=` (items plus facets), `GET /products/:slug` | Public |
| Category schema | `GET /categories/:id/schema`, `POST/PATCH /admin/categories`, `/admin/attributes`, `/admin/category-attributes` | Read: sellers. Write: admin |
| Shop management | `POST /shops` (apply), `POST /shops/:id/licence`, `PATCH /shops/:id`, `POST/DELETE /shops/:id/members` | Owner; admin for approval |
| Seller products | `POST/PATCH/DELETE /shops/:id/products`, `/variants`, `/images`, `POST /shops/:id/products/import` (CSV), `POST /shops/:id/upgrade`, `POST /category-requests` | Owner and staff of that shop |
| Wishlist and cart | `GET/POST/DELETE /wishlist`, `POST /wishlist/:id/move-to-cart`, `GET/POST/PATCH/DELETE /cart/items`, `POST /cart/merge` | Customer (cart also guest) |
| Checkout and orders | `POST /checkout/review`, `POST /checkout/place` (cash on delivery, guest or logged in), `POST /orders/lookup` (order number plus OTP), `GET /orders`, `POST /orders/:id/cancel`, `PATCH /shops/:id/orders/:orderId` | Guest or customer; shop for its own orders |
| Reviews, returns and complaints | `POST /reviews`, `POST /returns`, `PATCH /shops/:id/returns/:returnId`, `POST /complaints`, `PATCH /admin/complaints/:id` | Customer, shop, admin |
| Policies | `GET /policies/:type`, `POST /policies/:type/accept`, `POST /admin/policies` | Public; admin to publish |
| Try-on | `POST /me/tryon-photos`, `DELETE /me/tryon-photos/:id`, `POST /tryon`, `GET /tryon/:jobId` | Customer |
| Admin | `/admin/shops/:id/approve`, `/admin/licences/:id/verify`, `/admin/delivery-rates`, `/admin/users`, `/admin/reviews/:id/hide`, `/admin/payouts`, `/admin/audit` | Platform Admin |

Errors use one JSON shape: `{ error: { code, message, fields? } }` with 400, 401, 403, 404, 409, 422 and 429 used consistently.

### Code structure

The code is organised by feature, with folders for `auth`, `shops`, `licences`, `catalog-schema`, `products`, `search`, `wishlist`, `cart`, `checkout`, `orders`, `returns`, `complaints`, `reviews`, `policies`, `payouts`, `tryon` and `admin`. Each folder holds its UI, server actions or routes, services, Zod schemas and tests. All database access goes through a repository layer that requires a scope (`shopId` or `userId`), which makes cross-shop leaks hard to write by accident. Payments, couriers and SMS sit behind adapters so providers can be added or swapped later.

### Environments

There are three: local (Docker Compose with Postgres, Meilisearch and MinIO), staging with a preview per pull request, and production. Secrets live in the host's secret store and are never committed. The try-on provider runs in sandbox mode outside production.

## Security and threat model

The biggest risks are one shop reaching another shop's data, the leak of customers' body photos, and fraud around cash on delivery and medicine. Each is designed out, as the table below shows.

| Threat | Example | Mitigation |
| --- | --- | --- |
| Broken object-level access (IDOR) | Staff of shop A edits a product of shop B by changing the ID | A scoped repository layer, ownership checks in every handler, and automated tests for each endpoint across roles |
| Privilege escalation | Staff tries to invite users or a customer calls admin APIs | Role checks on the server, admin routes behind middleware, audit log |
| Try-on photo leak | A guessable URL or public bucket exposes body photos | Private bucket, random keys, signed URLs valid for 5 minutes or less, deletion on request, a DPA and region check with the provider |
| Forged medicine licence | A shop uploads an edited certificate | Admin verification against the issuing authority's records where possible, expiry tracking, audit log, suspension on fraud |
| Fake cash-on-delivery orders | A bot or prankster places many orders that are refused | Phone OTP, a limit of 3 open orders for new accounts, refusal tracking that blocks cash on delivery |
| Counterfeit or wrong-item listings | A shop lists fakes of a known brand | Shop approval with trade licence or DBID, returns for "not as described", reviews, and listing review in R2 |
| Review manipulation | Shops post fake reviews | Reviews only from delivered order items, one per item, hiding logged rather than deleting |
| Malicious uploads | SVG with script, oversized files, polyglot files in images, certificates or return photos | Allow-list of types, re-encode images, scan PDFs, size limits, separate file domain |
| Account takeover | Credential stuffing | Rate limits and lockout on login, breached-password check, optional 2FA for shop owners and admins |
| Injection and XSS | Product descriptions or policy text with HTML | ORM-parameterised queries, a sanitised markdown subset, a strict CSP |
| Price or stock tampering | The client sends its own price at checkout | The server recomputes every price, delivery charge and stock in a transaction at order placement |
| OTP abuse | A script triggers thousands of SMS | Per-number and per-IP rate limits, cooldowns, CAPTCHA after failures |
| Order lookup guessing | Someone tries order numbers to see other people's orders | Random, non-sequential order numbers, plus an OTP to the order's mobile, plus rate limits |
| Claiming someone else's orders | A person signs up with another customer's email | Orders attach only through a mobile or email verified by its owner |
| Off-platform deals | A seller asks buyers to order directly by phone | Platform-held cash on delivery, masked contact details where possible, seller score penalties for reported off-platform deals |
| Basic-tier fraud | A Basic seller takes orders and disappears | Order and listing limits, platform-held cash, NID on file, payouts only after delivery |
| Guest access to seller or admin areas | A logged-out user opens a seller-centre URL | Every seller and admin route requires login and the right role, checked on the server |
| Abuse of costly try-on | A script triggers thousands of try-ons | Per-user daily limit, per-IP rate limit, cached results, alert on spend |

## Roadmap and delivery

The plan assumes a team of 2–3 developers working in 2-week sprints. The added Bangladesh and seller-growth scope moves the MVP test gate to around week 17 and try-on to around week 29. Weeks are counted from the project start, which is still to be set.

### Sprint plan

| Sprint | Weeks | Focus | Stories |
| --- | --- | --- | --- |
| 0 | 1 | Repo, CI, environments, test mode switch, seed-data scripts, auth skeleton, design system, policy page shells | — |
| 1 | 2–3 | Accounts (mobile or email login), profile, phone OTP, Bangladesh addresses, admin user management | US-001–006 |
| 2 | 4–5 | Shop application, approval, staff invites, medicine-licence upload and verification | US-010–013, 015–017 |
| 3 | 6–7 | Category tree, attribute schema admin, required guideline fields, "Other" leaves, category requests | US-020–024 |
| 4 | 8–9 | Schema-driven product form, variants, images. Try-on spike runs in parallel (1 week) | US-030–033 |
| 5 | 10–11 | Search index with Bengali and Banglish spellings, dynamic filters, populated-category navigation, product page, wishlist | US-040–042, 044, 057, 045 (stretch) |
| 6 | 12–13 | Cart, guest and logged-in checkout up to payment, cash-on-delivery order placement, order split, invoices, guest order tracking and linking, per-shop delivery charges in the cart | US-007–009, 050–052, 056, 058 |
| 7 | 14–15 | Order lifecycle with 48 h timer, reviews, returns, complaints, policy acceptance, records and payout ledger | US-053, 055, 070–072, 080–082 |
| 8 | 16–17 | Seller growth tools: storefront pages and share links, CSV bulk upload, marketplace metrics dashboard, seller performance score (stretch). **MVP test gate** | US-014, 034, 083, 059 (stretch) |
| 9–11 | 18–23 | Online payments with escrow, courier integration with platform-held cash on delivery, Bengali UI, product matching, listing review and verified brands, sorting, reports | US-043, 046, 054, plus R2 stories |
| 12–14 | 24–29 | Try-on photo validation, garment images, try-on jobs, privacy controls, started after traction. **Try-on gate** | US-060–063 |

**Seller beta (end of week 9):** sellers can apply, be approved (Basic or Verified, medicine licence included) and list products through the category forms. Real sellers start onboarding in test mode, with no buyers yet, so the 100-shop target can be met by the MVP test gate. Seller accounts and listings are kept at release; only seed data is removed.

**MVP test gate (week 17):** all Must stories done in test mode, seed data loaded, the cross-role authorisation tests pass, a Lighthouse score of 90 or more on key pages, and a security review done.

**Release to real customers:** after the MVP test gate and every item on the pre-release checklist.

**Try-on gate:** at least 80% of 50 test try-ons rated acceptable by an internal panel (including local garments), p90 under 30 s, and the provider's DPA and processing region confirmed.

### Definition of Ready

- The story has acceptance criteria in Given/When/Then form, including error cases.
- UI wireframe attached where the story has a UI.
- Dependencies known, and the story is small enough to finish in one sprint.
- Bangladesh rules that apply are named (listing fields, timers, records), and the test-mode behaviour is defined if the story uses OTP, certificates, couriers or payments.
- The story is linked to its use case.

### Definition of Done

- Code reviewed and merged, with types, lint and tests passing in CI.
- Unit and integration tests cover the acceptance criteria, and an end-to-end test covers critical flows.
- Authorisation is tested for every role the endpoint touches.
- Money and security logic has automated tests: delivery charges, commission and payouts, fake-order limits, OTP, order linking and role checks.
- Works in test mode with the seed data. Any test-only shortcut has an item on the pre-release checklist.
- Accessibility checked (keyboard and an axe scan).
- Deployed to staging, acceptance criteria verified there, and the docs updated.

### Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Cold start: too few sellers, so no buyers | High | High | Seller beta at week 9, 100-shop target, storefront links, CSV upload, 0% commission launch offer |
| Commission leaking off-platform | High | High | Platform-held cash on delivery (D13), seller score, contact masking |
| Basic sellers misuse the easy sign-up | Medium | High | Limits per tier, NID on file, payouts after delivery |
| Scope too large for 2–3 developers | High | Medium | Strict R1 scope, two stretch stories, no Redis in R1, test gate at week 17, try-on only after traction |
| Customer distrust after past e-commerce scandals (58,720 complaints and about Tk 3,869 crore claimed, Aug 2026) | High | High | Cash on delivery, a visible 7-day returns policy, DBID in the footer, complaints within 72 h |
| A prescription flow is needed later | Low | Medium | Deferred by decision. The order and product model leave room for a prescription attachment |
| Launching with a compliance gap | Medium | High | Compliance epic in R1. Official text replaces the news summaries before release |
| Fake or refused cash-on-delivery orders | High | Medium | Phone OTP, open-order limit, refusal tracking. Testing values now, final limits before release |
| Test settings leak into production (dummy OTP, test certificates, seed data) | Low | High | Production start-up check, test-mode banner, pre-release checklist |
| Counterfeit and wrong-item listings | Medium | High | Shop approval with documents, "not as described" returns, reviews, listing review in R2 |
| Delivery delays before a courier is integrated | Medium | Medium | 48 h handover timer and alerts. Courier integration first in R2 |
| Manual refunds and payouts don't scale | Medium | Medium | Ledger tables now, so R2 can automate on top of them |
| Try-on quality disappoints, especially on loose local garments | Medium | High | Spike in Sprint 4 with saree, salwar kameez and panjabi samples, quality gate, label results as previews |
| Try-on photos breach the 2025 data ordinance | Medium | High | Consent records, provider region check or self-hosting, deletion as designed |
| Try-on cost per image grows with usage | Medium | Medium | Cache results, daily limits, an adapter allowing a move to a self-hosted model |
| Category schema too rigid for new shop types | Medium | Medium | Seller request flow, admin tooling for fast schema edits, migration jobs |
| Sellers list in the wrong category | High | Medium | Category search with suggestions, admin moderation queue, "report listing" in R2 |
| Competing on breadth against Daraz | High | Medium | Launch in 2–3 niches where clean filters matter most, as Rokomari did with books |
| Search index drifts from the database | Low | Medium | Index on every write through the queue, plus a nightly full reconcile |
| Cross-shop data leak | Low | High | Scoped repositories, role-by-endpoint test matrix, audit log |

