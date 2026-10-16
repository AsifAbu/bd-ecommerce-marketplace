# Marketplace web app

Next.js (App Router) + TypeScript + Tailwind, Prisma + PostgreSQL, Auth.js v5, pg-boss jobs.
Conventions for contributors and agents: `../.claude/knowledge/dev-conventions.md`.

## Prerequisites

- Node.js 22.12+ and npm
- Docker (for Postgres, Meilisearch, MinIO, Mailpit)

## Run locally

```bash
cp .env.example .env            # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d            # Postgres :5432, Meilisearch :7700, MinIO :9100 (console :9101), Mailpit :8025
npm install                     # also runs `prisma generate`
npx prisma migrate dev          # apply migrations
npm run seed                    # test users
npm run dev                     # http://localhost:3000
npm run worker                  # background jobs (separate terminal; add -- --demo to send a test job)
```

Change host ports in `.env` if any are busy.

## Test mode

`APP_MODE=test` shows a "Test mode" banner on every page. No SMS is sent: the OTP code is always **123456**.
The app refuses to start with `APP_MODE=production` and the dummy OTP enabled.

Seeded accounts (password `Test@12345`). Log in at `/api/auth/signin` with mobile or email:

| Account | Email | Mobile |
| --- | --- | --- |
| Platform Admin | admin@ecom.test | 01700000001 |
| Customer, verified phone | customer.verified@ecom.test | 01700000002 |
| Customer, new | customer.new@ecom.test | (none) |
| Customer, past COD refusals | customer.flagged@ecom.test | 01700000003 |

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright; first run
`npx playwright install chromium`), `worker`, `seed`, `db:migrate`, `db:push`.
