# Version history

| Version | Date | What changed |
| --- | --- | --- |
| v1 | 15 Oct 2026 | First plan: schema-driven catalog, dynamic filters, 4 roles, virtual try-on (hosted API), 32 stories, Next.js + Postgres + Meilisearch. Written as a Claude Doc |
| v2.0 | 15 Oct | Merged the Daraz/Rokomari comparison: Bangladesh compliance section, policy pages, 7-day returns, COD rules, medicine-shop licence gate, cart/wishlist/returns/complaints/compliance epics |
| v2.1 | 15 Oct | Testing-first: dummy OTP, test certificates, seed data (3 niches + pharmacy), pre-release checklist, delivery charges and commission set, guideline timings corrected (refund 10 days) |
| v2.2 | 15 Oct | Guest checkout and account linking; login required for shop and admin roles |
| v2.3 | 15 Oct | Expert review: seller tiers, storefront links, CSV upload, "Other" category, product matching (R2), platform-held COD money, go-to-market and revenue, marketplace metrics |
| v2.4 | 16 Oct | Knowledge-graph (graphify) review: all 55 stories traced to use cases (UC-43–50 added), seller beta at week 9, metrics dashboard (US-083), two stretch stories, no Redis in R1 (ADR-009), stronger Definition of Ready/Done |

Old Word files: `.claude/archive/`. Current Word files: `docs/`.

## Online Claude Docs (not kept in sync after v2.0)

- Plan v1: https://claude.ai/code/artifact/0e833ca4-54c4-4f12-8a7e-e77e1f385d97 (markdown copy: `.claude/online-docs/product-plan-v1.md`)
- Comparison with Daraz and Rokomari: https://claude.ai/code/artifact/4b792276-313a-4367-8016-9bd6ecf41aba (markdown copy: `.claude/online-docs/comparison-daraz-rokomari.md`)

## Graph review findings (v2.3, used for v2.4)

340 nodes, 911 edges, 14 communities. Fixed: 7 stories without use cases, no link between seller target and roadmap, Definition of Ready isolated, no metrics story. Still noted: R1 is the biggest hub (59 links) so scope is heavy; the catalog community has low cohesion (0.10). Report: `.claude/graph/GRAPH_REPORT.md`.
