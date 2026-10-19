# Project handoff: Multi-Vendor E-Commerce Platform (Bangladesh)

## Working rule (always)

**Read > Think > Ask first.** For every prompt: read the relevant files, think it through, and ask the owner about anything unclear or missing before building, generating or changing files. Answer plain questions directly.

## What the project is

**Dokan** (site name and logo, a cart whose body is the letter D; components in `web/src/components/brand/`, name in `web/src/lib/brand.ts`). **Dokan** (site name and logo, a cart whose body is the letter D; components in `web/src/components/brand/`, name in `web/src/lib/brand.ts`). "All online products in one place": an open marketplace where anyone can open a shop and sell; the platform owner doesn't sell. Bangladesh only. Its edge over Daraz: every product sits in one leaf category with a typed attribute schema, so search filters are always category-correct. Four roles: Platform Admin, Shop Owner, Shop Staff, Customer (guests can buy without an account; every other role must log in). Later: virtual try-on for tops and bottoms.

## Status (17 Oct 2026)

- **Phase:** building. Plan **v2.4**, 55 user stories, 29-week roadmap (seller beta week 9, MVP test gate week 17, R2 weeks 18–23, try-on R3 after traction).
- **Code (`main`, app in `web/`):** Sprint 0 foundation + wave 1 merged on 16 Oct 2026: accounts (US-001–006), shops (US-010–013, 015–017), catalog schema (US-020–024). Waves 2–3 merged on 17 Oct: listings (US-030–034), search, product page, wishlist, storefront, cart, policies, audit fixes. Sprint 6 checkout and orders (US-007–009, 051, 052; `features/orders`), merged with its migration. **R1 stories: all built, except the R2 and R3 items below** (checkout/orders, order lifecycle, returns, complaints, reviews, payouts and the rest are in `main`). Merged with its migration (`shop.performance_score`, `shop.performance_updated_at`): marketplace metrics dashboard `/admin/metrics` (US-083) and seller performance score (US-059, nightly job `shops.refresh-scores`; weights in `features/metrics/config.ts`). How agents work: `.claude/knowledge/dev-conventions.md` (worktree per feature, `db:push` on branches, migrations on `main`, owner approves merges).
- **Build approach:** testing first (dummy OTP 123456, test certificates accepted, seed data in 3 niches + a test pharmacy), then a pre-release checklist before real customers.
- **Key decisions:** cash on delivery only in R1; English text for now; flat delivery Tk 70 / Tk 130 + Tk 20/kg; seller tiers Basic/Verified; medicine shops need a verified licence, no prescription upload; platform holds COD money in production. Full list: `knowledge/decisions.md`.

## Where things are

| Need | File |
| --- | --- |
| The plan (owner's deliverable) | `docs/Product-Plan.docx` |
| Use case diagrams | `docs/Use-Case-Diagrams.docx` |
| Plan source (edit this, then rebuild) | `.claude/source/plan-v2.4.md` |
| All decisions D1–D15, ADRs, preferences | `.claude/knowledge/decisions.md` |
| Bangladesh rules, competitors, courier rates, sources | `.claude/knowledge/research.md` |
| Version history and online doc links | `.claude/knowledge/history.md` |
| How to rebuild the Word files / use the graph | `.claude/knowledge/how-to.md` |
| Knowledge graph of the plan | `.claude/graph/` |
| Daraz/Rokomari comparison, original plan | `.claude/online-docs/` |
| Old Word versions v1–v2.3 | `.claude/archive/` |

Read the knowledge files only when a task needs them; this page is enough to start.

## Working in the cloud (claude.ai/code)

- Repo: private GitHub `AsifAbu/bd-ecommerce-marketplace`. The owner instructs from claude.ai/code while their PC is off.
- Setup: the environment runs `bash web/scripts/cloud-setup.sh` (installs Postgres, Meilisearch, MinIO, Mailpit without Docker; npm ci; migrate; seed). If a service fails to install, say so in the PR.
- Flow per task: new branch `feature/<name>` or `fix/<name>` from `main` → build with tests → run `npm run lint && npm run typecheck && npm test && npm run build` in `web/` → push → open a **pull request** with `gh pr create` (summary, stories, test results). **Never merge to `main` yourself; the owner approves PRs.**
- Migrations: on a branch, add a Prisma migration only when the PR is meant to merge alone; note it in the PR.

## Open items and next steps

0. **Audit findings (ponytail audit, 16 Oct 2026): all fixed and merged (17 Oct).** Must fix: (1) FIXED staff invite now needs the invited email, verified (`shops/rules.ts` assertInviteEmailMatches, checked in the action and again in the repo transaction); (2) FIXED login lockout: 5 failures per identifier in 15 min lock it 15 min, 50 failures per IP per 15 min, stored in Postgres (`login_failure`, needs a migration on `main`), same generic error (`features/auth/login-throttle.ts`); (3) FIXED licence-expiry saves suspensions/expiries before emails, one failure doesn't stop the rest, failures reported (`shops/licence-expiry.ts`); (4) FIXED seed refuses APP_MODE=production/unset unless `ALLOW_PRODUCTION_SEED=true` (`prisma/seed-guard.ts`). Should fix: (5) FIXED rejecting a category request only deletes a still-pending option; (6) FIXED one shared form-action helper `src/lib/actions` + `src/lib/errors.ts` + `src/components/action-form.tsx` used by shops, catalog and accounts.

1. **R1 is built; next is testing and release.** Stories built and merged: US-001–009, 010–017, 020–024, 030–034, 040–045, 050–053, 055–059, 070–072, 080–083. Not built, planned for R2: US-054 (seller sales and payout reports), US-046 (product matching), online payments, courier integration and Bengali UI. R3: try-on (US-060–063). To confirm: VAT 0% while testing (prices VAT-inclusive), commission recorded per item, guest order attaches to an account only when that account's phone is verified, score floors (25% refusal, 20% return). Real-service testing (file storage, email, Meilisearch) still has to be done on a machine that can run them. Not yet approved: test charters (Word file in `docs/`).
2. Hosting plan: managed services first (e.g. Vercel + managed Postgres + Meilisearch Cloud + R2), region near Bangladesh.
3. **Before release** (pre-release checklist in the plan): official guideline text and Bengali Terms, DBID and compliance officer, real SMS provider, production medicine verification, final commission and fake-order limits, courier merchant account, 100 active shops, remove seed data, decide on prescriptions, confirm the Basic seller tier is legal.
4. Open questions: try-on budget (paid API or self-host).
