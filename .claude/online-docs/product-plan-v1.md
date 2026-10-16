# Multi-Vendor E-Commerce Platform — Product Plan

Oct 15, 2026 · @Asif

## Summary

Build a multi-vendor marketplace in three releases: the core marketplace (MVP), then payments and order operations, then virtual try-on. Try-on is the riskiest feature, so it ships last, behind a feature flag, on top of a catalog that already works.

Key recommendations:

- **The catalog is driven by a schema.** Admins define a category tree. Each leaf category carries its own typed attributes, such as Brand, Socket and Core count for Processor. Sellers fill those attributes through a form generated from the schema, and the search filters are built from the same attributes. Because a product can only hold its category's attributes, a filter from another category cannot appear.
- **Only leaf categories hold products.** Each product belongs to exactly one leaf category, and free-form tags do not exist.
- **Shoppers see only categories that have live stock.** A category is shown to shoppers when at least one active, in-stock product sits under it. Sellers always see the full tree.
- **Try-on uses a hosted diffusion model, not template overlays.** Use a virtual try-on model (IDM-VTON-class or a commercial try-on API) and run it asynchronously. A pose check at upload time enforces the full-body photo rule. Sellers add one flat garment image per apparel product at listing time.
- **Roles are enforced on the server and scoped per shop.** There are four roles: Platform Admin, Shop Owner, Shop Staff and Customer. Every shop-side query is filtered by `shop_id`.
- **Use a proven, boring stack.** TypeScript, Next.js, PostgreSQL, a search engine for faceted search (Meilisearch or OpenSearch), object storage for images and a job queue for try-on.

## Product brief

**Problem.** Small and mid-size shops of any type (pharmacy, bookstore, clothing, electronics) need a place to sell online without building a store themselves. Shoppers need to find the right product quickly. Today they meet noisy tags and irrelevant filters, and when buying clothes they can't tell how something will look on them.

**Personas**

| Persona | Role in system | Main job |
| --- | --- | --- |
| Platform Admin | Admin | Runs the marketplace: approves shops, owns the category and attribute schema, moderates content, handles disputes |
| Shop Owner | Organization admin | Sets up and runs one shop, invites and manages staff, sees orders and sales |
| Shop Staff | Shop user | Lists products, updates stock and prices, fulfils orders for their shop |
| Customer | Normal user | Browses, searches and filters, adds to cart, checks out, uses try-on |

**Goals**

1. A shopper reaches a relevant product list with correct filters in 3 clicks or one search.
2. A seller can list a product correctly in under 5 minutes, guided by the form for its category.
3. Try-on returns a believable result in under 30 seconds for supported garments.

**Non-goals (for now)**

- Native mobile apps. The site is responsive and mobile-first.
- Seller-defined categories or free-form tags.
- Try-on for garments other than tops and bottoms (no shoes, accessories or full dresses in v1).
- Prescription-medicine workflows. See the open questions.
- Multi-currency and multi-language at launch.

**Success metrics** (targets to confirm)

| Metric | Target |
| --- | --- |
| Search-to-product-view rate | ≥ 40% |
| Filter usage on category pages | ≥ 25% of sessions |
| Seller listing completion rate | ≥ 85% of started listings |
| Try-on to add-to-cart rate | Higher than the same products without try-on (A/B test) |
| Checkout conversion | ≥ 2% of sessions |

## Assumptions and open questions

The plan rests on the assumptions below. Each one changes scope if it turns out wrong, so confirm them before Sprint 1.

**Assumptions**

| # | Assumption | If wrong |
| --- | --- | --- |
| A1 | Marketplace model: one platform, many independent shops, one shared cart that can hold items from several shops | One shop per checkout simplifies payments and orders |
| A2 | The platform takes payments and pays shops out, keeping a commission (Stripe Connect or a local equivalent such as SSLCommerz) | Cash on delivery only removes the payout and KYC work |
| A3 | One country, one currency and one language at launch | Add i18n and currency work to R2 |
| A4 | Shops must be approved by the Platform Admin before they can sell | Self-serve onboarding needs stronger fraud controls |
| A5 | Only the Platform Admin can create categories and attributes. Sellers can request new ones | — |
| A6 | Try-on covers tops and bottoms (shirts, t-shirts, jackets, pants, jeans, skirts) | Full dresses need a different model mode |
| A7 | A small team (1–3 developers) on a modest cloud budget | Changes the build-vs-buy choices |

**Open questions**

- [ ] Which country and payment providers? This decides the payment gateway and the KYC requirements.
- [ ] Will medicine shops sell prescription-only items? If so, they need prescription upload and pharmacist verification, which brings regulatory work. The recommendation is OTC only at launch.
- [ ] Who delivers: each shop with its own couriers, or a platform logistics partner?
- [ ] Can a Customer also become a Shop Owner with the same account? Recommended: yes, one account with roles added.
- [ ] Is there a budget for a paid try-on API, or must try-on be self-hosted on a GPU?
- [ ] Product reviews and ratings: in scope for R1 or later?
- [ ] Do shops need variants (size and colour) with stock per variant? This is assumed **yes** for clothing.

## Roles and permissions

There are four roles, and two of them are scoped to a single shop. A user has one personal account and profile. Roles are attached to the account: `PLATFORM_ADMIN` applies globally, while `SHOP_OWNER` and `SHOP_STAFF` are held through a membership row tying the user to a shop. Every account is a Customer by default, so a shop owner can also shop.

| Capability | Platform Admin | Shop Owner | Shop Staff | Customer |
| --- | --- | --- | --- | --- |
| Own profile and photo | Yes | Yes | Yes | Yes |
| Browse, cart, checkout, try-on | Yes | Yes | Yes | Yes |
| Manage category tree and attributes | Yes | No (can request) | No | No |
| Approve or suspend shops | Yes | No | No | No |
| Edit shop profile and settings | Any shop | Own shop | No | No |
| Invite or remove shop staff | Any shop | Own shop | No | No |
| Create and edit products | Any (moderation) | Own shop | Own shop | No |
| Delete products | Any | Own shop | Optional, owner-granted | No |
| Manage stock and prices | No | Own shop | Own shop | No |
| View and fulfil orders | All | Own shop | Own shop | Own orders |
| View sales and payouts | All | Own shop | No | No |
| Manage users and roles | Yes | Own staff only | No | No |

Rules:

- The server checks permission on every request and never trusts the UI. Every query on shop-side data includes `shop_id = <member's shop>`. This guards against IDOR, where a user changes an ID to reach another shop's data.
- Admin actions such as suspending a shop or editing another shop's product are written to an audit log.
- At the MVP, Shop Staff get a fixed permission set. Later the owner can toggle permissions per staff member, for example letting someone delete products or see reports.

## Categories, attributes and dynamic filters

One schema per leaf category drives three things: the seller's form, the stored product data and the shopper's filters. The filter panel is built from the schema and the matching products, so it can only show attributes that belong to that category.

&#91;embedded content: schema-driven catalog · one schema, five stages\]

The seller form, the server check and the filter panel all read the same schema, so a Processor page cannot show a Book filter.

### Category tree

- Categories form a tree, for example Electronics → Computer Components → Processor, or Fashion → Men → Pants.
- **A product attaches to exactly one leaf category.** Parent categories exist only for navigation.
- Only the Platform Admin edits the tree. Sellers can send a "request new category" form, which the admin reviews.

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
| Medicine (OTC) | **Brand**, **Generic name**, **Dosage form** (tablet, syrup), **Strength (mg)**, Pack size |
| Men's Pants | **Brand**, **Fit**, **Material**, **Size** (variant), **Colour** (variant), **Try-on eligible** |

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

The recommendation is an image-based virtual try-on model, called asynchronously, with a pose check when the user uploads a photo. Your "template photo" idea is kept in a better form: the seller uploads one clean garment image, and the model fits it to the user's photo.

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

- Ask for explicit consent before the first upload, and say what happens to the photo.
- Keep photos in a private bucket and serve them only through short-lived signed URLs. They are never public.
- Choose a provider that does not keep or train on uploaded images. Get this in writing in the data-processing agreement.
- The user can delete their photos and results at any time. Results are deleted automatically after 30 days.
- Never show try-on photos to sellers or admins in normal admin views.

## Epics and user stories

The plan has 32 stories in 8 epics. Each ID traces through to code, tests and reviews. The full Given/When/Then acceptance criteria are written below for the stories that carry the most risk. The rest get theirs in sprint refinement (Definition of Ready).

| ID | Epic | Story | Priority |
| --- | --- | --- | --- |
| US-001 | Accounts | As a visitor, I want to sign up with email or Google so that I can buy products | Must |
| US-002 | Accounts | As any user, I want to edit my profile (name, phone, avatar, addresses) so that my details are correct | Must |
| US-003 | Accounts | As any user, I want to reset my password and verify my email so that my account is secure | Must |
| US-004 | Accounts | As a Platform Admin, I want to view, suspend and change the roles of users so that I can keep the platform safe | Must |
| US-010 | Shops | As a customer, I want to apply to open a shop (name, type, documents) so that I can sell | Must |
| US-011 | Shops | As a Platform Admin, I want to approve, reject or suspend shops so that only legitimate sellers operate | Must |
| US-012 | Shops | As a Shop Owner, I want to edit my shop profile (logo, banner, policies) so that customers trust my shop | Must |
| US-013 | Shops | As a Shop Owner, I want to invite staff by email and remove them so that my team can help run the shop | Must |
| US-014 | Shops | As a customer, I want to see a shop's page with its products so that I can browse one seller | Should |
| US-020 | Catalog schema | As a Platform Admin, I want to manage the category tree so that products are organised consistently | Must |
| US-021 | Catalog schema | As a Platform Admin, I want to define attributes and assign them to leaf categories so that each category has the right fields and filters | Must |
| US-022 | Catalog schema | As a seller, I want to request a new category or enum option so that I can list items that don't fit yet | Should |
| US-030 | Listings | As shop staff, I want to create a product in one leaf category through a form generated for it so that my listing is complete and filterable | Must |
| US-031 | Listings | As shop staff, I want to add variants (size, colour) with their own stock and price so that customers can pick the right one | Must |
| US-032 | Listings | As shop staff, I want to upload product images so that customers can see the product | Must |
| US-033 | Listings | As shop staff, I want to edit, deactivate or delete products and update stock so that the catalog stays accurate | Must |
| US-034 | Listings | As shop staff, I want to bulk-import products from CSV for one category so that I can onboard quickly | Could |
| US-040 | Discovery | As a customer, I want to see only categories that have products so that I never land on an empty page | Must |
| US-041 | Discovery | As a customer, I want to search products by keyword so that I find what I need | Must |
| US-042 | Discovery | As a customer, I want filters that match the category I'm browsing so that I can narrow results precisely | Must |
| US-043 | Discovery | As a customer, I want to sort by price, newest and rating so that I can compare | Should |
| US-044 | Discovery | As a customer, I want a product detail page with specs, images, variants and shop info so that I can decide | Must |
| US-050 | Cart and checkout | As a customer, I want to add items from several shops to one cart so that I can buy together | Must |
| US-051 | Cart and checkout | As a customer, I want to check out with an address and payment so that I can complete my purchase | Must |
| US-052 | Cart and checkout | As a customer, I want to see my order history and status so that I can track deliveries | Must |
| US-053 | Orders | As shop staff, I want to see and update orders for my shop (confirm, ship, deliver, cancel) so that I can fulfil them | Must |
| US-054 | Orders | As a Shop Owner, I want to see sales and payout reports so that I know how my shop is doing | Should |
| US-055 | Orders | As a customer, I want to rate and review a delivered product so that others can benefit | Could |
| US-060 | Try-on | As a customer, I want to upload a full-body photo with instant validation so that I can use Try on | Should |
| US-061 | Try-on | As shop staff, I want to upload a garment image for apparel products so that they become try-on eligible | Should |
| US-062 | Try-on | As a customer, I want to click Try on and see the garment on my photo so that I know how it looks on me | Should |
| US-063 | Try-on | As a customer, I want to delete my try-on photos and results so that I control my data | Must (with try-on) |

### Acceptance criteria for the highest-risk stories

**US-030 Create product through the category form**

- Given I am shop staff and pick the leaf category "Processor", when the form loads, then it shows exactly the attributes assigned to Processor, in display order, with required fields marked.
- Given a required attribute is empty, when I submit, then the save is blocked and the field shows an error.
- Given I send an attribute that does not belong to Processor, through the API directly, when the server validates it, then the request is rejected with a 422 and the attribute named.
- Given I pick a non-leaf category, when I submit, then the request is rejected.
- Given I am staff of shop A, when I try to create a product for shop B, then the request is rejected with a 403.

**US-040 Shoppers see only populated categories**

- Given "Processor" has 0 active, in-stock products from approved shops, when a customer views the category menu, then Processor is not shown.
- Given a seller publishes the first in-stock processor, when the count job runs (within 1 minute), then Processor and its parent categories appear.
- Given a seller opens the listing form, when the category picker loads, then every leaf category is shown, empty or not.

**US-042 Dynamic filters**

- Given I am on Processor results, when the filter panel renders, then it shows only Processor's filterable attributes plus the common ones (price, rating, shop).
- Given I select Brand = AMD, when results update, then the other facets show counts within the AMD results, and options with 0 results are hidden or disabled.
- Given I copy the URL with filters applied, when someone opens it, then they see the same results and filter state.
- Given my search spans several categories, when results render, then only common filters and a "Narrow by category" list appear.

**US-060 Upload try-on photo**

- Given I upload a photo cut off at the knees, when validation runs, then it is marked invalid with the message "Please upload a full-length photo (head to feet)".
- Given I upload a photo with two people, when validation runs, then it is rejected with "Only one person should be in the photo".
- Given a valid photo, when saved, then its EXIF data is removed and it can only be reached through a signed URL that expires.

**US-062 Try on**

- Given I have no valid full-body photo, when I click Try on, then I see the upload prompt and no job is created.
- Given a valid photo and an eligible top, when I click Try on, then I see progress and a result within 30 s at p90, labelled as an AI preview.
- Given I already tried this garment with this photo, when I click Try on again, then the cached result shows at once.
- Given the provider fails or times out, when the job ends, then I see "Try on is unavailable right now" and am not charged against my daily limit.
- Given I have reached the daily limit, when I click Try on, then I see when I can try again.

## Prioritisation and MVP

The MVP proves the core loop: approved shops list products through category forms, and customers find them with correct filters and place an order. Online payment and try-on come after it.

| Release | Scope | Stories |
| --- | --- | --- |
| R1 — MVP | Accounts and profiles, shop onboarding and staff, category and attribute schema, schema-driven listing with variants and images, populated-category navigation, search with dynamic filters, product page, multi-shop cart, checkout with **cash on delivery**, order status for customers and shops | US-001–004, 010–013, 020–021, 030–033, 040–042, 044, 050–053 |
| R2 — Commerce | Online payments and shop payouts, sales reports, shop pages, sorting, category and option requests | US-014, 022, 043, 054, plus payment stories to write once the gateway is chosen |
| R3 — Try-on | Try-on photo upload and validation, garment images, try-on generation, data controls | US-060–063 |
| Later | CSV bulk import, reviews, per-staff permissions, recommendations, wishlists, coupons | US-034, 055 |

**Won't do now:** native apps, prescription medicines, multi-currency, live chat between buyer and seller, and seller-defined tags.

Cash on delivery keeps payment integration and payout KYC out of the MVP. If online payment is required on day one, move the payment stories into R1 and expect about 2–3 more weeks.

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | Core Web Vitals at p75: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Search and filter API p95 < 300 ms. Product page server render p95 < 500 ms |
| Try-on latency | p90 < 30 s end to end. The UI never blocks while it runs |
| Scale (initial) | 1,000 shops, 100,000 products and 200 concurrent users without redesign |
| Security | OWASP Top 10 and ASVS level 2 practices. Role and shop-scoped authorisation on every endpoint. Rate limits on auth, search and try-on |
| Privacy | Explicit consent for try-on photos, private storage, user-triggered deletion, a 30-day retention for try-on results, EXIF stripping. Comply with local data-protection law (and GDPR if EU users are allowed) |
| Payments | No card data touches our servers. Use the gateway's hosted fields (PCI DSS SAQ-A) |
| Accessibility | WCAG 2.2 AA. The filter panel works by keyboard, and the try-on result has alt text and an announced status |
| SEO | Server-rendered category and product pages, clean filter URLs, canonical tags on filter combinations, sitemap, Product structured data |
| Reliability | 99.5% uptime target. Daily database backups with 7-day point-in-time recovery. RPO ≤ 24 h, RTO ≤ 4 h. Try-on failures degrade gracefully |
| Observability | Structured logs, error tracking (Sentry), uptime checks, and alerts on 5xx rate, search latency and try-on failure rate |
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
| Auth | Auth.js (NextAuth) or Better Auth: email and password plus Google. Sessions in an httpOnly cookie |
| Validation | Zod, with schemas generated from category attribute definitions |
| UI | Tailwind CSS with shadcn/ui components |
| Files | S3-compatible object storage (AWS S3 or Cloudflare R2) with a CDN. Separate buckets for public product images and private try-on photos |
| Jobs | Redis with BullMQ for search indexing, category counts, try-on jobs and email |
| Try-on | Hosted try-on API behind an adapter interface, so it can later swap to a self-hosted model |
| Pose check | MediaPipe Pose: the web build in the browser and the Python or Node build on the server |
| Payments (R2) | Stripe Connect, or a local gateway such as SSLCommerz, depending on country |
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
| ADR-005 | Hosted try-on API behind an adapter | Ships fastest and avoids GPU ops | Cost per image and a third party handles body photos, which needs a DPA |
| ADR-006 | Asynchronous try-on jobs | Generation takes seconds, and HTTP requests shouldn't block | Needs a queue, a worker and result polling |

## Architecture

One Next.js app serves pages and the API. PostgreSQL is the source of truth, Meilisearch serves search and facets, and a background worker handles indexing, counts and try-on jobs.

&#91;embedded content: system architecture · 7 components, 1 external\]

Requests never wait on slow work: indexing, category counts and try-on generation go through the queue to the worker.

### Data model (key tables)

| Table | Key fields | Notes |
| --- | --- | --- |
| `user` | id, email, password\_hash, name, phone, avatar\_url, is\_platform\_admin, status | Every person, every role |
| `address` | id, user\_id, line1, city, postcode, is\_default |  |
| `shop` | id, name, slug, type, logo\_url, status (`pending`, `approved`, `suspended`), owner\_id |  |
| `shop_member` | shop\_id, user\_id, role (`owner`, `staff`), permissions JSONB | Unique on (shop\_id, user\_id) |
| `category` | id, parent\_id, name, slug, is\_leaf, live\_product\_count, path | `path` as ltree or a materialised path for subtree queries |
| `attribute` | id, key, name, type, unit | Defined once globally |
| `attribute_option` | id, attribute\_id, value, label, status (`active`, `pending`) | Values for enum attributes |
| `category_attribute` | category\_id, attribute\_id, required, filterable, filter\_widget, display\_order, is\_variant\_axis | Assignment with category-specific settings |
| `product` | id, shop\_id, category\_id (leaf only), title, slug, description, status, attributes JSONB, tryon\_type (`none`, `upper`, `lower`) | Index on (category\_id, status) |
| `product_attribute_value` | product\_id, attribute\_id, option\_id or value\_number or value\_text | Typed source of truth |
| `product_variant` | id, product\_id, sku, price, stock, variant\_attrs JSONB | Size and colour SKUs |
| `product_image` | id, product\_id, url, kind (`gallery`, `garment`), position | `garment` is the try-on input |
| `cart_item` | user\_id, variant\_id, qty |  |
| `order` | id, user\_id, status, total, payment\_status, address snapshot | One customer order |
| `shop_order` | id, order\_id, shop\_id, status, subtotal | Split by shop for fulfilment |
| `order_item` | shop\_order\_id, variant\_id, qty, unit\_price, title snapshot |  |
| `tryon_photo` | id, user\_id, storage\_key, status (`valid_full_body`, `invalid`), reason, consent\_at | Private bucket |
| `tryon_result` | id, user\_id, photo\_id, product\_id, status, storage\_key, expires\_at | Cache key is (photo\_id, product\_id) |
| `audit_log` | id, actor\_id, action, entity, entity\_id, data, at | Admin and owner actions |

### API surface

| Area | Endpoints | Who |
| --- | --- | --- |
| Auth and profile | `POST /auth/*`, `GET/PATCH /me`, `/me/addresses` | Any signed-in user |
| Catalog (public) | `GET /categories?visible=true`, `GET /search?q=&category=&filters=&sort=&page=` (returns items plus facets), `GET /products/:slug` | Public |
| Category schema | `GET /categories/:id/schema` (form definition), `POST/PATCH /admin/categories`, `/admin/attributes`, `/admin/category-attributes` | Read: sellers. Write: admin |
| Shop management | `POST /shops` (apply), `PATCH /shops/:id`, `POST/DELETE /shops/:id/members` | Owner; admin for approval |
| Seller products | `POST/PATCH/DELETE /shops/:id/products`, `/variants`, `/images` | Owner and staff of that shop |
| Cart and orders | `/cart`, `POST /checkout`, `GET /orders`, `PATCH /shops/:id/orders/:orderId` | Customer; shop for its own orders |
| Try-on | `POST /me/tryon-photos` (validates), `DELETE /me/tryon-photos/:id`, `POST /tryon` (returns job id), `GET /tryon/:jobId` | Customer |
| Admin | `/admin/shops/:id/approve`, `/admin/users`, `/admin/audit` | Platform Admin |

Errors use one JSON shape: `{ error: { code, message, fields? } }` with 400, 401, 403, 404, 409, 422 and 429 used consistently.

### Code structure

The code is organised by feature, with folders for `auth`, `shops`, `catalog-schema`, `products`, `search`, `cart`, `orders`, `tryon` and `admin`. Each folder holds its UI, server actions or routes, services, Zod schemas and tests. All database access goes through a repository layer that requires a scope (`shopId` or `userId`), which makes cross-shop leaks hard to write by accident.

### Environments

There are three: local (Docker Compose with Postgres, Redis, Meilisearch and MinIO), staging with a preview per pull request, and production. Secrets live in the host's secret store and are never committed. The try-on provider runs in sandbox mode outside production.

## Security and threat model

The two biggest risks are one shop reaching another shop's data and the leak of customers' body photos. Both are designed out, as the table below shows.

| Threat | Example | Mitigation |
| --- | --- | --- |
| Broken object-level access (IDOR) | Staff of shop A edits a product of shop B by changing the ID | A scoped repository layer, ownership checks in every handler, and automated tests for each endpoint across roles |
| Privilege escalation | Staff tries to invite users or a customer calls admin APIs | Role checks on the server, admin routes behind middleware, audit log |
| Try-on photo leak | A guessable URL or public bucket exposes body photos | Private bucket, random keys, signed URLs valid for 5 minutes or less, no listing permission, deletion on request, a DPA with the provider |
| Malicious uploads | SVG with script, oversized files, polyglot files | Allow-list of image types, re-encode every image on the server, size limits, separate image domain |
| Fake or fraudulent shops | Scam shops collect cash-on-delivery orders | Admin approval, document upload, suspension and order hold tools, rate limits on new shops |
| Account takeover | Credential stuffing | Rate limits and lockout on login, breached-password check, optional 2FA for shop owners and admins |
| Injection and XSS | Product descriptions with HTML | ORM-parameterised queries, a sanitised markdown subset for descriptions, a strict CSP |
| Price or stock tampering | The client sends its own price at checkout | The server recomputes every price and checks stock in a transaction at checkout |
| Abuse of costly try-on | A script triggers thousands of try-ons | Per-user daily limit, per-IP rate limit, cached results, alert on spend |
| Schema poisoning | Junk enum options flood the filters | New options are pending until an admin approves them |

## Roadmap and delivery

The plan assumes a team of 2–3 developers working in 2-week sprints, so the MVP lands around week 13 and try-on around week 25. Weeks are counted from the project start, which is still to be set.

### Sprint plan

| Sprint | Weeks | Focus | Stories |
| --- | --- | --- | --- |
| 0 | 1 | Repo, CI, environments, auth skeleton, design system | — |
| 1 | 2–3 | Accounts, profile, admin user management | US-001–004 |
| 2 | 4–5 | Shop application, approval, staff invites | US-010–013 |
| 3 | 6–7 | Category tree and attribute schema admin | US-020, 021 |
| 4 | 8–9 | Schema-driven product form, variants, images. Try-on spike runs in parallel (1 week) | US-030–033 |
| 5 | 10–11 | Search index, dynamic filters, populated-category navigation, product page | US-040–042, 044 |
| 6 | 12–13 | Cart, cash-on-delivery checkout, orders, hardening. **MVP launch gate** | US-050–053 |
| 7–9 | 14–19 | Online payments, payouts, reports, shop pages, sorting, category requests | US-014, 022, 043, 054 |
| 10–12 | 20–25 | Try-on photo validation, garment images, try-on jobs, privacy controls. **Try-on gate** | US-060–063 |

**MVP launch gate:** all Must stories done, the cross-role authorisation tests pass, a Lighthouse score of 90 or more on key pages, and a security review done.

**Try-on gate:** at least 80% of 50 test try-ons rated acceptable by an internal panel, p90 under 30 s, and the provider's DPA signed.

### Definition of Ready

- The story has acceptance criteria in Given/When/Then form, including error cases.
- UI wireframe attached where the story has a UI.
- Dependencies known, and the story is small enough to finish in one sprint.

### Definition of Done

- Code reviewed and merged, with types, lint and tests passing in CI.
- Unit and integration tests cover the acceptance criteria, and an end-to-end test covers critical flows.
- Authorisation is tested for every role the endpoint touches.
- Accessibility checked (keyboard and an axe scan).
- Deployed to staging, acceptance criteria verified there, and the docs updated.

### Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Try-on quality disappoints (wrong fit, distorted garments) | Medium | High | Spike in Sprint 4, quality gate before launch, label results as previews, limit to tops and bottoms |
| Try-on cost per image grows with usage | Medium | Medium | Cache results, daily limits, an adapter allowing a move to a self-hosted model |
| Category schema too rigid for new shop types | Medium | Medium | Seller request flow, admin tooling for fast schema edits, migration jobs |
| Sellers list in the wrong category | High | Medium | Category search with suggestions, admin moderation queue, a "report listing" button |
| Search index drifts from the database | Low | Medium | Index on every write through the queue, plus a nightly full reconcile |
| Cross-shop data leak | Low | High | Scoped repositories, role-by-endpoint test matrix, audit log |
| Payment or KYC rules delay R2 | Medium | Medium | Cash on delivery in the MVP, and choose the gateway early |
| Medicine sales hit regulation | Medium | High | OTC only, admin-controlled medicine categories, legal review before launch |
