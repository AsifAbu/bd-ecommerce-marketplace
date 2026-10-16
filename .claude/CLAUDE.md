# Project handoff: Multi-Vendor E-Commerce Platform (Bangladesh)

## Working rule (always)

**Read > Think > Ask first.** For every prompt: read the relevant files, think it through, and ask the owner about anything unclear or missing before building, generating or changing files. Answer plain questions directly.

## What the project is

"All online products in one place": an open marketplace where anyone can open a shop and sell; the platform owner doesn't sell. Bangladesh only. Its edge over Daraz: every product sits in one leaf category with a typed attribute schema, so search filters are always category-correct. Four roles: Platform Admin, Shop Owner, Shop Staff, Customer (guests can buy without an account; every other role must log in). Later: virtual try-on for tops and bottoms.

## Status (16 Oct 2026)

- **Phase:** building. Plan **v2.4**, 55 user stories, 29-week roadmap (seller beta week 9, MVP test gate week 17, R2 weeks 18–23, try-on R3 after traction).
- **Code (local git, `main`, app in `web/`):** Sprint 0 foundation + wave 1 merged on 16 Oct 2026: accounts (US-001–006), shops (US-010–013, 015–017), catalog schema (US-020–024). 241 unit tests + 8 e2e tests pass. How agents work: `.claude/knowledge/dev-conventions.md` (worktree per feature, `db:push` on branches, migrations on `main`, owner approves merges).
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

## Open items and next steps

1. **Next wave (needs owner's go):** Sprint 4 product listing form (US-030–034, uses the catalog schema API), which unlocks the seller beta at week 9. Not yet approved: test charters (Word file in `docs/`).
2. Hosting plan: managed services first (e.g. Vercel + managed Postgres + Meilisearch Cloud + R2), region near Bangladesh.
3. **Before release** (pre-release checklist in the plan): official guideline text and Bengali Terms, DBID and compliance officer, real SMS provider, production medicine verification, final commission and fake-order limits, courier merchant account, 100 active shops, remove seed data, decide on prescriptions, confirm the Basic seller tier is legal.
4. Open questions: try-on budget (paid API or self-host).
