# Product Plan vs Daraz and Rokomari

Oct 15, 2026 · @Asif

## Summary

The plan's catalog design is stronger than Daraz's. Its biggest gaps are the Bangladesh rules it never mentions and the trust features both competitors rely on. The plan was written with no country chosen. Comparing it with Daraz and Rokomari implies the target is Bangladesh, and that changes payments, compliance, logistics and language.

**Where the plan is ahead**

- **Clean, category-specific filters.** Searching Daraz for "processor" returns 2,434 products across 20 categories, from CPUs to food processors and guitar pedals. The same filter panel mixes in Colour Family, Material, Size "EU M" and junk warranty values such as "112". The plan's one-leaf-category, schema-driven design avoids exactly this.
- **Virtual try-on.** Neither competitor offers it. Daraz's documented answer to fit problems is a 14-day change-of-mind return on fashion.

**Where the original plan was behind, and what is decided now**

1. **No returns and refunds policy at all.** Daraz now gives 14 days (up from 7 in October 2025), and Rokomari advertises a "Happy Return" policy.
2. **Bangladesh's Digital Commerce Operation Guidelines 2021 are not covered.** They set delivery within 5 days in the same city and 10 days outside it, complaint resolution within 72 hours, seller payment within 10 days, visible ratings that cannot be deleted, and 6-year record keeping.
3. **No DBID registration in the original plan.** Now planned for the footer (change 10). Terms are in English for now, with a Bengali version before the public launch.
4. **The original payment plan (Stripe Connect) didn't fit the market.** Decision: cash on delivery only for now. When online payments are added, use bKash and Nagad with Bangladesh Bank's escrow model, not Stripe.
5. **Medicine was planned as "OTC only", with no licence check.** Resolved: medicine shops must upload their approval certificate and pass admin verification before approval (change 11).
6. **Privacy is described only as "local law".** The Personal Data Protection Ordinance 2025 now applies, and try-on body photos make this a high-stakes area.
7. **Logistics, authenticity and the mobile app were missing.** Logistics and the app are deferred by decision (flat delivery charges now). Authenticity checks beyond shop approval are still a gap.

**Top recommendations (updated):** for R1, build policy pages, returns, cash on delivery, cart, wishlist and checkout up to the payment step, all to the Bangladesh guidelines. Online payments, courier integration and Bengali come later. Medicine shops are approved only after their drug licence certificate is verified. The full list of eleven is in What to improve.

## At a glance

Daraz is an open, general marketplace that is broad but noisy. Rokomari is a curated, books-first store that is narrow but tightly run. The plan sits between them: an open multi-vendor marketplace with Rokomari-style catalog control.

|  | Daraz | Rokomari | Our plan |
| --- | --- | --- | --- |
| Model | Open multi-vendor marketplace with DarazMall for brand stores. Stores in Pakistan, Bangladesh, Nepal, Sri Lanka and Myanmar | Publishers list their books, Rokomari buys and holds stock, and runs its own fulfilment. Launched January 2012 with about 10,000 books, now 200,000+ titles | Open multi-vendor marketplace. Shops apply, are approved, and list into admin-owned categories |
| Catalog control | Seller-chosen categories, with loose attributes shared across categories | Publishers enter details, then Rokomari's team approves each listing. Every item is barcoded | Admin-owned category tree. One leaf category per product, and a typed attribute schema per category |
| Payments | Cash on delivery, bKash, Nagad, Rocket, Visa, Mastercard, Amex, EMI | Cash on delivery since 2012, plus cards | Cash on delivery only. Online payments come later |
| Delivery | Seller- or platform-shipped, with service filters for "Fast Delivery" and shipping location | Own team in Dhaka, couriers elsewhere. Same day or 24 h in Dhaka, 2–3 days outside | Flat inside- or outside-Dhaka charge. Courier provider added later |
| Returns | 14 days for defective or wrong items. Change of mind only in fashion, sports clothing and kids' clothing | "Happy Return" and refund policies linked on every product page | 7 days. Change of mind for fashion. Medicine excluded (planned) |
| Support | Help Center, Central Complain Management System | Hotline 16297 (9 am to 11 pm, Saturday to Thursday), email and WhatsApp | Complaint tickets resolved within 72 h (planned) |
| Apps | Android, iOS and Huawei AppGallery, rated 4.8 | Mobile app (first-order promo code) | Responsive web only. Native apps are a non-goal |
| Distinctive feature | Flash sales, vouchers, 11.11 mega sale | Category dominance in books, personalised recommendations, pre-orders | Dynamic category filters and virtual try-on |

## Feature comparison

The plan leads on catalog quality and try-on. It trails on trust, payments and retention features. "Not seen" means this research didn't observe it, not that the feature definitely doesn't exist.

| Feature | Daraz | Rokomari | Our plan (updated) | Status |
| --- | --- | --- | --- | --- |
| Category-specific filters only | No: mixed, cross-category filters | Books-first, so this isn't a problem | Yes, schema-driven | Ahead |
| One category per product | No: one search spans 20 categories | Yes in practice | Yes | Ahead |
| Listing review before going live | Not seen | Yes, team approval | Shop approval. Medicine shops also need a verified licence | Partly. Add listing review later |
| Authentic-brand storefront | DarazMall | Not applicable | None | Gap. Add a "Verified brand" badge later |
| Returns window | 14 days | Return and refund policies | 7 days. Change of mind for fashion | Now in R1 (change 2) |
| Cash on delivery | Yes | Yes | Only payment method | Now in R1 (change 3) |
| bKash, Nagad, Rocket | Yes | Not seen | Later | Deferred by decision |
| EMI and cards | Yes | Cards | Later | Deferred by decision |
| Cart management | Yes | Yes | Grouped by shop, stock and price checks, save for later | Now in R1 (change 4) |
| Wishlist | Not seen | Yes ("want this item", favourites) | Add, remove, move to and from cart | Now in R1 (change 5) |
| Own or managed logistics | Shipping-location and fast-delivery filters | Own Dhaka fleet plus couriers | Flat inside- or outside-Dhaka charge. Provider later | Deferred by decision |
| Delivery-speed promise | Fast Delivery filter | 24 h Dhaka, 2–3 days outside; 30–40 days for imported books, shown on the page | Depends on the provider | Deferred by decision |
| Ratings and reviews | Yes, star filter | Yes, ratings and reviews | Buyer-only reviews, never deleted | Now in R1 (change 9) |
| Support and complaints | Help Center, complaint system | Hotline, email, WhatsApp | Complaint tickets resolved within 72 h | Now in R1 (change 9) |
| Recommendations, "bought together" | Not seen | Yes, personalised | Later | Deferred |
| Vouchers, coins, flash sales | Yes | Loyalty points, vouchers | Later | Deferred |
| Pre-orders | Not seen | Yes | No | Could |
| Native app | Yes, rated 4.8 | Yes | Responsive web | Deferred |
| "Report incorrect information" | Not seen | Yes | Not yet a story | Gap. Add with listing review |
| Virtual try-on | Not seen | Not applicable | R3 | Unique |
| Multi-shop cart | Yes (marketplace) | Single retailer | Yes, one order per shop | OK |

## Key differences

The main difference is that the plan treats catalog structure as the product, while both competitors win on operations: delivery, returns, payment choice and support.

### 1. Catalog structure: our strongest advantage

Daraz shows what happens without a strict schema. For the query "processor" its search API returned:

- 2,434 results across 20 categories, including Food Processors, Surround Processors, Effects Pedals and Juicers.
- 26 brands mixing Intel and AMD with Sokany, Panasonic and Philips, which are kitchen appliance brands.
- Filters that don't belong to CPUs: Size "EU M", Colour Family (28 colours), Material (18 values) and "Number of memory slots".
- A Warranty filter with 22 values, including unexplained numbers such as 3, 7, 112 and 34 alongside "1 Year".
- No Socket or Core-count filter, which are the two filters a CPU buyer needs most.

This is the problem your original idea described. The plan's leaf-category rule, admin-approved enum options and query-to-category resolution fix it. Keep them non-negotiable.

### 2. Curation: Rokomari's model, which we partly copy

Rokomari approves every publisher listing and barcodes every item in stock. The plan approves shops but lets approved staff publish listings straight away. On an open marketplace that is how fake and miscategorised listings get in, so add a per-listing review for new shops and risky categories.

### 3. Inventory and fulfilment

Rokomari holds stock and delivers itself in Dhaka (same day or 24 h). Daraz exposes delivery speed and shipping location as filters. The plan has neither a delivery model nor a delivery promise, Decision: flat delivery charges for now, with the courier provider and delivery speed added later. Orders are built ready to plug a provider in (change 8).

### 4. Returns versus try-on

Daraz reduces the risk of buying clothes with a 14-day change-of-mind return. The plan reduces it with try-on before purchase. These complement each other: try-on should lower return rates, but it can't replace a returns policy. That policy is a trust baseline and, in practice, a market expectation.

### 5. Payments

Both competitors started with cash on delivery, which matches the plan's MVP. Daraz now also offers bKash, Nagad, Rocket, cards and EMI. Decision: cash on delivery only for now. When online payments are added, start with bKash and Nagad through an escrow-compliant gateway rather than Stripe.

### 6. Growth and retention

Rokomari built category dominance through content, loyalty points, vouchers and email rather than heavy discounting, plus personalised recommendations. Daraz runs flash sales, vouchers and 11.11. The plan has no retention features until "Later".

## Standards not yet followed

With the eleven changes, the plan covers six of the nine Bangladesh requirements. Two are partly covered (Bengali terms, data-protection consent records). Escrow applies only once online payments are added.

| # | Standard | Source | What it requires | Status in the updated plan |
| --- | --- | --- | --- | --- |
| 1 | Digital Commerce Operation Guidelines 2021: delivery | Ministry of Commerce | Hand over within 48 h of a paid order. Deliver within 5 days in the same city and 10 days elsewhere | Covered: 48 h handover timer and overdue alerts (change 8). Delivery speed depends on the courier, added later |
| 2 | Guidelines: refunds | Ministry of Commerce | Refund within 7 days by the original method if a paid order misses its deadline (draft wording) | Covered for cash on delivery: refunds recorded and paid manually (change 2). Automatic refunds come with online payments |
| 3 | Guidelines: listing content | Ministry of Commerce | Show quantity, ingredients, price, delivery charges, images, and purchase and return conditions | Covered: required in every category schema (change 7) |
| 4 | Guidelines: complaints and reviews | Ministry of Commerce | A complaint channel, complaints recorded and resolved within 72 h, and ratings that the platform cannot erase | Covered (change 9) |
| 5 | Guidelines: seller payouts and records | Ministry of Commerce | Pay sellers within 10 days after commission. Keep records for 6 years | Covered: COD collections logged per shop, 6-year retention (change 10) |
| 6 | Guidelines: medicine | Ministry of Commerce | Medicine and healthcare products need a Directorate General of Drug Administration licence | Covered: certificate upload and admin verification before shop approval (change 11). No prescription upload by decision, pending a legal check |
| 7 | DBID registration (2022) | Ministry of Commerce, RJSC | Register for a DBID, show it on the site, and publish terms and conditions in Bengali | Partly: DBID in the footer (change 10). Terms in English for now, with Bengali before the public launch |
| 8 | Escrow for advance payments | Bangladesh Bank | Advance payments are released to the seller only after delivery is confirmed | Not needed yet: cash on delivery only. Applies when online payments are added |
| 9 | Personal Data Protection Ordinance 2025 | Approved 9 Oct 2025; some parts take effect 18 months after gazette notification | Specific consent, purpose and retention notices, prompt breach reports to the national data authority, cross-border transfer limits | Partly: privacy policy (change 1). Consent records and a breach runbook still needed; urgent before try-on |
| — | Market norm: returns policy | Daraz 14 days. The 2025 Daraz announcement says most competitors give 1–7 days | — | Covered: 7 days (change 2) |
| — | Market norm: mobile wallets | Daraz lists bKash, Nagad and Rocket | — | Deferred by decision |
| — | Market norm: Bengali UI | Rokomari's pages are Bengali-first | — | Deferred by decision: English for now |

The guidelines rows come from news coverage, and some of it describes the 2021 draft. Read the official text before building to it.

## Risks

The comparison raises the plan's risk on trust, compliance and the market, not on technology. After the updates, the highest risks are customer trust, whether prescription-only medicines may be sold without a prescription, and counterfeit listings.

| Risk | Evidence from the comparison | Likelihood | Impact | Mitigation (updated plan) |
| --- | --- | --- | --- | --- |
| Launching without the Bangladesh compliance basics | DBID, delivery timers, refunds, complaints and records are required by the Ministry of Commerce rules | Medium | High | Changes 1–11 in R1. Bengali terms and a legal review before the public launch |
| Customer distrust after past e-commerce scandals | 58,720 complaints filed with the consumer rights directorate and about Tk 3,869 crore claimed against failed platforms (Aug 2026) | High | High | Cash on delivery only, a visible 7-day returns policy, DBID on the site. Escrow when online payments arrive |
| Prescription-only medicines sold without a prescription | No prescription upload by decision. Whether this is allowed was not confirmed in this research | Medium | High | Legal check before launch. Fallback: a per-product "OTC" flag, listing only flagged items |
| Counterfeit and wrong-item listings | Daraz promises "100% original". The plan has no per-listing checks | Medium | High | Shop approval and medicine licence checks now. Listing review, "Verified brand" and "report listing" later |
| Fake or refused cash-on-delivery orders | Cash on delivery is the only method | High | Medium | Phone OTP before the first order, order confirmation, limits on open orders per new account |
| Delivery delays before a courier is integrated | Rokomari runs its own fleet. The plan uses flat charges and shop handover | Medium | Medium | 48 h handover timer and overdue alerts. Courier integration next |
| Try-on photos breach the 2025 data ordinance | The ordinance demands specific consent and limits cross-border transfers | Medium | High | Choose a provider and region with an agreement, or self-host, before R3 |
| Try-on doesn't work on local clothing | Unverified assumption: try-on models are mostly trained on fitted Western clothing, so loose local garments may fail | Medium | Medium | Test saree, salwar kameez and panjabi samples in the spike |
| Competing on breadth against Daraz | Daraz is a general marketplace with flash sales, vouchers and 11.11 | High | Medium | Launch in 2–3 niches where clean filters matter most, as Rokomari did with books |

## What to improve

Updated scope (15 Oct 2026): Bangladesh only, all policy text in English for now, cash on delivery as the only payment method, and everything up to the payment step built to the Bangladesh guidelines. The eleven changes below are all for R1.

| # | Change | Done means | Basis |
| --- | --- | --- | --- |
| 1 | **Policy pages (English text)** | Terms, Privacy, Return and Refund, Delivery and Cash on Delivery, and Seller policy pages. Linked in the footer and at checkout, versioned, and acceptance recorded at sign-up and checkout | Guidelines 2021: purchase and return conditions must be disclosed. DBID guideline: published terms |
| 2 | **Return and refund** | 7 days from delivery for damaged, wrong, incomplete or not-as-described items. Change of mind for fashion only. Exclusions: food, innerwear, perishables, digital and custom items, and medicine. A return request flow with reason, photos and status. Cash-on-delivery refunds recorded and paid manually until online payments exist | Guidelines: return conditions on every listing. Market norm (Daraz 14 days) |
| 3 | **Cash on delivery** | The only payment option. Phone OTP before the first order, confirmation by SMS and email, free cancellation before dispatch | Market norm (Daraz, Rokomari) |
| 4 | **Cart** | Add, update and remove. A variant must be chosen. Quantity capped at stock. Grouped by shop with a subtotal and delivery charge per shop. Prices and stock re-checked with a change notice. Guest cart merged at login. Save for later | Guidelines: show stock, price and delivery charges |
| 5 | **Wishlist** | Add and remove, move between wishlist and cart, current price and stock shown, guests asked to log in | Market norm (Rokomari favourites) |
| 6 | **Checkout up to payment** | Address book in Bangladesh format (division, district, upazila or thana, area), with an 11-digit mobile number required. Review page with items per shop, delivery charge, discount and total. Policy acceptance. Placing an order splits it into one order per shop. Confirmation page and an email invoice showing all charges | Guidelines: price and charge disclosure, a bill showing charges |
| 7 | **Required listing fields** | Quantity or unit, ingredients or materials where relevant, price, delivery charge, images, return eligibility and stock, all enforced by the category schema | Guidelines: listing content |
| 8 | **Order lifecycle, ready for a delivery provider** | Statuses: placed, confirmed, packed, handed over, delivered, cancelled and returned. The shop confirms and hands over within 48 h, with overdue alerts. Delivery charge is a flat inside-Dhaka or outside-Dhaka rate set by the admin. Courier fields are left pluggable | Guidelines: 48 h handover, delivery within 5 days in the same city and 10 days elsewhere |
| 9 | **Reviews and complaints** | Reviews from verified buyers only. The platform hides abusive reviews with a logged reason and never deletes them. A complaint ticket system with a 72 h resolution timer | Guidelines: reviews can't be erased, complaints resolved within 72 h |
| 10 | **Compliance records** | DBID shown in the site footer. Order, seller and complaint records kept for 6 years. Cash-on-delivery collections logged per shop, so sellers can be paid within 10 days | DBID guideline 2022. Guidelines: 6-year records, payment within 10 days |
| 11 | **Medicine shop verification** (your decision) | Choosing the Medicine shop type requires uploading the approval certificate: the drug licence number, its expiry date and the document. The admin verifies it before approving the shop. Until then the shop can't list products, and medicine categories accept products only from verified shops. The system warns before the licence expires and suspends listings when it lapses | Guidelines: medicine sales need a drug-administration licence |

**Deferred:**

- **Online payments:** bKash, Nagad and cards, through an escrow-compliant gateway (Bangladesh Bank escrow policy).
- **Delivery:** courier integration and delivery-speed promises such as same day, which depend on the provider.
- **Bengali:** a Bengali UI, and Bengali terms. The DBID guideline asks for Bengali terms, so add them before the public launch.
- **Prescription medicines:** decided not to have a prescription upload. Customers buy medicine from verified shops directly. Before launch, confirm with a lawyer or the drug administration that this is allowed for prescription-only medicines. If it isn't, restrict v1 to OTC products with a per-product "OTC" flag.
- **Other features:** try-on (R3), the mobile app, and retention features (vouchers, recommendations).

## Sources

All pages were opened on 15 Oct 2026. Our-plan facts come from the Multi-Vendor E-Commerce Platform Product Plan.

- [Daraz Bangladesh home page](https://www.daraz.com.bd/): payment methods, countries, app rating, "100% original" claim
- [Daraz search results for "processor" (JSON)](https://www.daraz.com.bd/catalog/?ajax=true&q=processor): result count, categories, filter groups
- [Daraz Returns Policy](https://www.daraz.com.bd/return-policy): 14-day window, change-of-mind categories, exclusions
- [Daraz introduces 14-day return policy, Dhaka Tribune, 23 Oct 2025](https://www.dhakatribune.com/business/394653/daraz-introduces-14-day-return-policy)
- [Rokomari.com, Wikipedia](https://en.wikipedia.org/wiki/Rokomari.com): launch, ownership, model
- [Demystifying Rokomari, Future Startup](https://futurestartup.com/2022/07/08/demystifying-rokomari-and-digital-platform-decisions): operations, logistics, catalog approval, growth
- [Rokomari product page](https://www.rokomari.com/book/305800): delivery promise, hotline, return policy links, recommendations
- [Overview of the Digital Commerce Operation Guidelines 2021, The Daily Star](https://www.thedailystar.net/law-our-rights/news/overview-the-digital-commerce-operation-guidelines-2021-2128871)
- [E-commerce cos must deliver products within 5 days, TBS (draft guidelines)](https://www.tbsnews.net/economy/e-commerce-cos-must-deliver-products-within-5-days-268159)
- [NID sufficient for securing digital business ID, The Daily Star, 30 Jun 2022](https://www.thedailystar.net/business/economy/news/nid-sufficient-securing-digital-business-id-3060886)
- [Over 58,000 e-commerce complaints lodged, Dhaka Tribune, 31 Aug 2026](https://www.dhakatribune.com/business/418715/over-58-000-e-commerce-complaints-lodged): complaints, escrow policy, DBID count
- [Personal Data Protection Ordinance 2025: key takeaways, The Daily Star](https://www.thedailystar.net/tech-startup/news/bangladeshs-personal-data-protection-ordinance-2025-key-takeaways-4015401)

Not found: Daraz's current commission rates and Rokomari's exact return window in days. Neither was published on the pages opened.
