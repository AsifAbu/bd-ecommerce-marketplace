# Developer conventions (for parallel feature agents)

## Repo layout
- Root: `docs/` (Word deliverables, don't touch), `.claude/` (knowledge), `.github/workflows/ci.yml`, `web/` (the app).
- `web/src/app/` routes only (thin). `web/src/features/<feature>/` holds a feature's UI, server actions, services, Zod schemas and tests (`auth`, `shops`, `catalog-schema`, `products`, `cart`, `checkout`...).
- `web/src/lib/` shared code: `config.ts` (APP_MODE), `startup-guard.ts`, `db.ts` (Prisma), `auth/` (guards), `otp/` (adapter), `jobs/` (pg-boss), `errors.ts` (`AppError`, `toErrorBody`), `actions/` (`runAction`, `ActionResult`, `parseForm`, `ValidationError`), `client-ip.ts`. `web/src/components/` shared UI (`action-form.tsx` with `ActionForm`/`Field`, `form-styles.ts`). `web/src/auth.ts` Auth.js config.
- Never import from another feature's internals; move shared code to `src/lib/`.

## Database and Prisma
- One schema file per feature: `web/prisma/schema/<feature>.prisma`. Don't put models in `base.prisma`. Touch other features' files only to add the back-relation field.
- Tables and columns are snake_case via `@@map`/`@map` (see `auth.prisma`). IDs: `String @id @default(cuid())`.
- **Feature branches do NOT commit migrations.** Use `npm run db:push` against your own database. Migrations are generated on `main` after merge (`npx prisma migrate dev --name <feature>`).
- Each worktree uses its own database on the shared Postgres container: set `DATABASE_URL=postgresql://ecom:ecom@localhost:5432/ecom_<feature>?schema=public` in that worktree's `web/.env`. `db push` creates it.
- Generated client: `@/generated/prisma/client` (git-ignored; `npm install` / `npx prisma generate`).
- Extend `web/prisma/seed.ts` with an idempotent `seed<Feature>()` (upserts, `[TEST]` names, `@ecom.test` emails).

## Record retention (US-081)
- Business records are kept **6 years** (Guidelines 2021). The list lives in `web/src/lib/retention.ts` (`RETENTION_RULES`): orders, shop orders, order items, COD collections, returns, shops, shop licences, complaints, audit log, policy versions and policy acceptances.
- **Never hard-delete these rows** (no `.delete()`/`.deleteMany()`/raw `DELETE`, also not in the seed). Close them with a status instead (`suspended`, `cancelled`, `resolved`, `hidden`). Relations from a retained model to a non-retained one use `onDelete: Restrict` or `SetNull`, never `Cascade`. User accounts linked to retained records are anonymised, not deleted.
- Adding a retained model: add it to `RETENTION_RULES` (set `built: true` once the model exists). `src/lib/retention.test.ts` scans `src/` and `prisma/seed.ts` for deletes and the schema for cascades, and fails the build on a violation.
- No purge job yet; one may only remove rows past `retainUntil()` and must be listed in `retention.ts` first.

## Policies and consent (US-080)
- Other features use `@/features/policies` (server) or `@/features/policies/client` (client components). Checkout: `getCurrentVersions(CHECKOUT_POLICY_SLUGS)` + `<PolicyConsent>` in the form, then `readPolicyConsent()` + `recordAcceptance({ userId | guestPhone, slugs, context: "checkout", shownVersions, ...await requestMeta() })`, and `assertAcceptedCurrent(userId, CHECKOUT_POLICY_SLUGS)` (422 `POLICY_ACCEPTANCE_REQUIRED`). Store the returned `{ slug, version }` list on the order.

## Orders (US-051, Sprint 6)
- `features/orders` holds checkout and orders. Pure API: `@/features/orders` (statuses `OPEN_STATUSES`/`STATUS_LABELS`, `getOrderConfig()` with the D8/D14/VAT/launch-offer values, `toOrderView`, order numbers). Wired: `@/features/orders/server` (`placementService`, `viewableOrder`, `ordersOfUser`, `invoiceOrder`, `shopOrdersOf`, `linkGuestOrdersFor`, `notifyOrderPlaced`).
- Sprint 7 changes a shop order's status on `shop_order` (set `statusChangedAt`; `deliveredAt` on delivery; `cancelReason` on cancel). Never delete orders, shop orders or items. Customer-facing amounts come from the snapshots, never from current listings.
- SMS go through `src/lib/sms` (test mode logs); OTP purposes `checkout_verify` and `order_track` belong to orders.

## Reviews (US-055)
- `features/reviews`: pure rules in `@/features/reviews`; wired `reviewService` in `@/features/reviews/server`. Seller score (US-059): `reviewService.shopRating(shopId, { from, to }?)` -> `{ count, average, histogram }`. Metrics (US-083): `reviewService.metrics({ from, to })`. Product pages: `reviewService.productRating(productId)`.
- `product_rating` is rewritten in the same transaction as every review write (repo `recomputeRating`); search documents read it (`rating`, `ratingCount`). Reviews are retained 6 years and never deleted; moderation sets `status = hidden` with a reason in `audit_log`.

## Shop-scoped data access (ADR-004)
- Every shop-side query takes a `shopId` and filters by it: `getProduct(shopId, productId)` uses `where: { id: productId, shopId }`, never `findUnique({ where: { id } })`.
- Repositories in `features/<feature>/repo.ts` take the scope (`shopId` or `userId`) as the first argument. Pages and actions call a guard first, then pass the checked `shopId`.
- Every repo function needs a test showing another shop's data is not returned.

## Auth and roles
- Login: mobile or email + password (`src/auth.ts`, JWT session cookie). Guards: `requireUser()`, `requirePlatformAdmin()` from `@/lib/auth`; they throw `UnauthorizedError` (401) / `ForbiddenError` (403) and re-read the user from the DB.
- Error JSON shape: `{ error: { code, message, fields? } }`. Throw an `AppError` subclass (feature rule errors extend it); server actions wrap their body in `runAction()` from `@/lib/actions`, route handlers use `toErrorBody()` from `@/lib/errors`.
- Login lockout (`features/auth/login-throttle.ts`): 5 failed logins per identifier in 15 min lock it for 15 min; e2e tests that log in with wrong passwords should use their own fresh account.
- Cache Components is on: anything reading cookies/session/env at request time goes inside `<Suspense>` and calls `await connection()` first.

## Test mode
- Read the mode only through `getConfig()` / `isTestMode()` (`src/lib/config.ts`). OTP via `createOtpProvider()`; test code 123456.
- Any test-only shortcut must be listed on the pre-release checklist in the plan.

## Jobs
- Add a queue + Zod payload in `src/lib/jobs/queues.ts`, its handler in `handlers.ts`. Name queues `<feature>.<action>`. Enqueue with `sendJob()`. Run with `npm run worker`.

## Tests and checks (run in `web/`)
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest, `*.test.ts` next to the code), `npm run build`. E2E: `e2e/*.spec.ts`, `npm run test:e2e`.
- Unit-test logic without Next/DB by injecting dependencies (see `lib/auth/guards-core.ts`).

## Commits
- Conventional style: `feat(cart): ...`, `fix(auth): ...`, `chore: ...`, `test: ...`, `docs: ...`. Small, logical commits. Local git only; no pushing.

## Definition of Done
- Lint, typecheck, tests and build pass. Unit/integration tests cover the acceptance criteria; an e2e test covers critical flows.
- Authorisation tested for every role the endpoint touches; money and security logic has automated tests.
- Works in test mode with seed data (seed extended). Accessibility checked (keyboard + axe). Docs updated.
