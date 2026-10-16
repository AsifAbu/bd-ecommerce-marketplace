# Graph Report - graph-corpus  (2026-10-16)

## Corpus Check
- Corpus is ~15,098 words - fits in a single context window. You may not need a graph.

## Summary
- 340 nodes · 911 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 256 edges (avg confidence: 0.84)
- Token cost: 107,540 input · 0 output

## Community Hubs (Navigation)
- Catalog schema and listings
- Accounts, cart and guest checkout
- Market decisions and competitors
- Returns, reviews and shop roles
- Virtual try-on pipeline
- Seller tiers and medicine licence
- Guidelines, COD money and orders
- Shopper use cases (Diagram 1)
- Discovery, matching and R2
- COD, delivery and providers
- Security and threat model
- Tech stack
- Policy pages
- Definition of Ready

## God Nodes (most connected - your core abstractions)
1. `R1 — MVP (Bangladesh, cash on delivery)` - 59 edges
2. `Multi-Vendor E-Commerce Platform Product Plan v2.3` - 55 edges
3. `Data model (key tables)` - 31 edges
4. `Diagram 2: Shop and platform management` - 27 edges
5. `Risk register` - 21 edges
6. `Security and threat model` - 18 edges
7. `Diagram 1: Shopping, guest checkout and try-on` - 17 edges
8. `Schema-driven catalog` - 16 edges
9. `Digital Commerce Operation Guidelines 2021` - 16 edges
10. `System architecture (Next.js app, PostgreSQL, Meilisearch, worker)` - 14 edges

## Surprising Connections (you probably didn't know these)
- `See only populated categories (included use case)` --semantically_similar_to--> `Shoppers see only categories with live stock`  [INFERRED] [semantically similar]
  use-cases-v2.3.md → product-plan-v2.3.md
- `Try-on provider (external AI service)` --semantically_similar_to--> `Try-on option B: Hosted try-on API`  [INFERRED] [semantically similar]
  use-cases-v2.3.md → product-plan-v2.3.md
- `Validate full-body photo (included use case)` --semantically_similar_to--> `Full-body photo validation (pose check)`  [INFERRED] [semantically similar]
  use-cases-v2.3.md → product-plan-v2.3.md
- `Use Case Diagrams v2.3` --references--> `Multi-Vendor E-Commerce Platform Product Plan v2.3`  [INFERRED]
  use-cases-v2.3.md → product-plan-v2.3.md
- `Guest shopper` --conceptually_related_to--> `Guest checkout and account linking`  [INFERRED]
  use-cases-v2.3.md → product-plan-v2.3.md

## Hyperedges (group relationships)
- **One category schema drives seller form, server validation and shopper filters** — product_plan_v2_3_schema_driven_catalog, product_plan_v2_3_seller_listing_flow, product_plan_v2_3_dynamic_filter_generation, product_plan_v2_3_attribute_definitions, product_plan_v2_3_table_category_attribute, product_plan_v2_3_ext_zod, product_plan_v2_3_ext_meilisearch [EXTRACTED 1.00]
- **Guest checkout, OTP verification and account linking flow** — product_plan_v2_3_guest_checkout, product_plan_v2_3_us_007, product_plan_v2_3_us_008, product_plan_v2_3_us_009, use_cases_v2_3_uc_06, use_cases_v2_3_uc_07, use_cases_v2_3_uc_10, use_cases_v2_3_verify_mobile_by_otp, product_plan_v2_3_table_order [INFERRED 0.85]
- **Try-on pipeline: photo validation, garment image, async generation, privacy** — product_plan_v2_3_virtual_try_on, product_plan_v2_3_full_body_photo_validation, product_plan_v2_3_try_on_flow, product_plan_v2_3_try_on_privacy_controls, use_cases_v2_3_uc_14, use_cases_v2_3_uc_15, use_cases_v2_3_uc_17, use_cases_v2_3_try_on_provider, product_plan_v2_3_table_tryon_photo, product_plan_v2_3_table_tryon_result [INFERRED 0.85]

## Communities (14 total, 1 thin omitted)

### Community 0 - "Catalog schema and listings"
Cohesion: 0.10
Nodes (34): API: Category schema, API: Seller products, Attribute definitions (type, options, filterable, is_variant_axis), Data model (key tables), Epic: Catalog schema, Zod, Compliance req: No expired, counterfeit or adulterated goods, Required listing fields (Bangladesh guidelines) (+26 more)

### Community 1 - "Accounts, cart and guest checkout"
Cohesion: 0.15
Nodes (36): API: Auth and profile, API: Checkout and orders, API: Wishlist and cart, Epic: Accounts, Epic: Cart and wishlist, MVP test gate (week 17), R1 — MVP (Bangladesh, cash on delivery), Risk: Scope too large for 2–3 developers (+28 more)

### Community 2 - "Market decisions and competitors"
Cohesion: 0.10
Nodes (26): Commission per category (testing values), DBID registration guideline 2022, Epic: Compliance, Epic: Listings, Epic: Returns and support, bKash, Daraz, Rokomari (+18 more)

### Community 3 - "Returns, reviews and shop roles"
Cohesion: 0.11
Nodes (34): API: Reviews, returns and complaints, Platform Admin, Compliance req: 72 h complaint resolution, Risk: Manual refunds and payouts don't scale, Shop Owner, Shop Staff, Table: complaint_ticket, Table: return_request (+26 more)

### Community 4 - "Virtual try-on pipeline"
Cohesion: 0.14
Nodes (24): API: Try-on, Epic: Try-on, CatVTON, IDM-VTON, MediaPipe Pose, OOTDiffusion, Personal Data Protection Ordinance 2025, R3 — Try-on (after traction) (+16 more)

### Community 5 - "Seller tiers and medicine licence"
Cohesion: 0.17
Nodes (23): API: Admin, API: Shop management, API surface, Basic seller tier, Epic: Shops, Compliance req: Drug-administration licence for medicine sales, Compliance req: Seller identity and registration disclosure, Risk: Basic sellers misuse easy sign-up (+15 more)

### Community 6 - "Guidelines, COD money and orders"
Cohesion: 0.12
Nodes (23): Bangla Tribune (guideline summary source), Digital Commerce Operation Guidelines 2021, Epic: Orders, Sentry, Non-functional requirements, Compliance req: Seller payout within 10 days, Compliance req: 48 h handover requirement, Compliance req: 6-year record retention (+15 more)

### Community 7 - "Shopper use cases (Diagram 1)"
Cohesion: 0.16
Nodes (24): Customer, US-070 Request return within 7 days, Diagram 1: Shopping, guest checkout and try-on, Generate try-on image (included use case), Guest shopper, See only populated categories (included use case), Try-on provider (external AI service), UC-01 Browse categories (+16 more)

### Community 8 - "Discovery, matching and R2"
Cohesion: 0.16
Nodes (20): API: Catalog (public), Bangladesh Bank escrow policy, Epic: Discovery, Nagad, R2 — Payments, delivery and Bengali, Compliance req: Advance payments held in escrow, Compliance req: Refund within 10 days if paid order undelivered, Risk: Sellers list in wrong category (+12 more)

### Community 9 - "COD, delivery and providers"
Cohesion: 0.12
Nodes (11): Cash on delivery rules, eCourier, FASHN try-on API, Google Vertex AI virtual try-on, Paperfly courier, RedX courier, Bangladeshi SMS gateway, Risk: Fake or refused COD orders (+3 more)

### Community 10 - "Security and threat model"
Cohesion: 0.16
Nodes (15): Admin audit logging, Definition of Done, Risk: Cross-shop data leak, Security and threat model, Threat: Account takeover, Threat: Claiming someone else's orders, Threat: Forged medicine licence, Threat: Guest access to seller or admin areas (+7 more)

### Community 11 - "Tech stack"
Cohesion: 0.14
Nodes (13): Auth.js / Better Auth, GitHub Actions, Meilisearch, Next.js (App Router) + TypeScript, OpenSearch / Elasticsearch, Vitest, Testing Library, Playwright, PostgreSQL, Prisma or Drizzle ORM (+5 more)

### Community 12 - "Policy pages"
Cohesion: 0.30
Nodes (11): API: Policies, Delivery and Cash on Delivery Policy, Privacy Policy, Return and Refund Policy, Seller Policy, Terms and Conditions, Compliance req: Prior consent for personal data and cookies, Table: policy_acceptance (+3 more)

## Ambiguous Edges - Review These
- `Seller tiers (Basic / Verified / Medicine shop)` → `Compliance req: Seller identity and registration disclosure`  [AMBIGUOUS]
  product-plan-v2.3.md · relation: conceptually_related_to
- `Free storefront link` → `Daraz`  [AMBIGUOUS]
  product-plan-v2.3.md · relation: conceptually_related_to

## Knowledge Gaps
- **33 isolated node(s):** `Give contact and address (included use case)`, `Verified seller tier`, `Definition of Ready`, `Definition of Done`, `Later release (featured listings, hub, per-staff permissions)` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 36 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Multi-Vendor E-Commerce Platform Product Plan v2.3` connect `Market decisions and competitors` to `Catalog schema and listings`, `Accounts, cart and guest checkout`, `Returns, reviews and shop roles`, `Virtual try-on pipeline`, `Seller tiers and medicine licence`, `Guidelines, COD money and orders`, `Shopper use cases (Diagram 1)`, `Discovery, matching and R2`, `COD, delivery and providers`, `Security and threat model`, `Tech stack`, `Policy pages`?**
  _High betweenness centrality (0.443) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `R1 — MVP (Bangladesh, cash on delivery)` (e.g. with `MVP test gate (week 17)` and `Sprint 0: repo, CI, test mode, seed scripts`) actually correct?**
  _`R1 — MVP (Bangladesh, cash on delivery)` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Give contact and address (included use case)`, `Verified seller tier`, `Definition of Ready` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Catalog schema and listings` be split into smaller, more focused modules?**
  _Cohesion score 0.1024390243902439 - nodes in this community are weakly interconnected._
- **Why does `R1 — MVP (Bangladesh, cash on delivery)` connect `Accounts, cart and guest checkout` to `Catalog schema and listings`, `Market decisions and competitors`, `Returns, reviews and shop roles`, `Seller tiers and medicine licence`, `Guidelines, COD money and orders`, `Shopper use cases (Diagram 1)`, `Discovery, matching and R2`, `Policy pages`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Seller tiers (Basic / Verified / Medicine shop)` and `Compliance req: Seller identity and registration disclosure`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Free storefront link` and `Daraz`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._