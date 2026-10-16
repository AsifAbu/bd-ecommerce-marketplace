# Developer conventions (for parallel feature agents)

## Repo layout
- Root: `docs/` (Word deliverables, don't touch), `.claude/` (knowledge), `.github/workflows/ci.yml`, `web/` (the app).
- `web/src/app/` routes only (thin). `web/src/features/<feature>/` holds a feature's UI, server actions, services, Zod schemas and tests (`auth`, `shops`, `catalog-schema`, `products`, `cart`, `checkout`...).
- `web/src/lib/` shared code: `config.ts` (APP_MODE), `startup-guard.ts`, `db.ts` (Prisma), `auth/` (guards), `otp/` (adapter), `jobs/` (pg-boss). `web/src/components/` shared UI. `web/src/auth.ts` Auth.js config.
- Never import from another feature's internals; move shared code to `src/lib/`.

## Database and Prisma
- One schema file per feature: `web/prisma/schema/<feature>.prisma`. Don't put models in `base.prisma`. Touch other features' files only to add the back-relation field.
- Tables and columns are snake_case via `@@map`/`@map` (see `auth.prisma`). IDs: `String @id @default(cuid())`.
- **Feature branches do NOT commit migrations.** Use `npm run db:push` against your own database. Migrations are generated on `main` after merge (`npx prisma migrate dev --name <feature>`).
- Each worktree uses its own database on the shared Postgres container: set `DATABASE_URL=postgresql://ecom:ecom@localhost:5432/ecom_<feature>?schema=public` in that worktree's `web/.env`. `db push` creates it.
- Generated client: `@/generated/prisma/client` (git-ignored; `npm install` / `npx prisma generate`).
- Extend `web/prisma/seed.ts` with an idempotent `seed<Feature>()` (upserts, `[TEST]` names, `@ecom.test` emails).

## Shop-scoped data access (ADR-004)
- Every shop-side query takes a `shopId` and filters by it: `getProduct(shopId, productId)` uses `where: { id: productId, shopId }`, never `findUnique({ where: { id } })`.
- Repositories in `features/<feature>/repo.ts` take the scope (`shopId` or `userId`) as the first argument. Pages and actions call a guard first, then pass the checked `shopId`.
- Every repo function needs a test showing another shop's data is not returned.

## Auth and roles
- Login: mobile or email + password (`src/auth.ts`, JWT session cookie). Guards: `requireUser()`, `requirePlatformAdmin()` from `@/lib/auth`; they throw `UnauthorizedError` (401) / `ForbiddenError` (403) and re-read the user from the DB.
- Error JSON shape: `{ error: { code, message, fields? } }`.
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
