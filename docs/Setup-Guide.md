# Setup Guide

One place to rebuild this project from nothing: on your own machine for local testing, or hosted
somewhere others can open a link. Written so that after months away, you can follow it top to
bottom without having to re-derive anything.

If something here goes stale, the source of truth for local setup is `web/README.md`; this file
should be kept in step with it. Everything else the project needs — the plan, decisions, test
plan — is listed in `.claude/CLAUDE.md` under "Where things are".

---

## 1. What this is, in one paragraph

A Bangladesh multi-vendor marketplace. Next.js (App Router) + TypeScript + Tailwind for the app,
PostgreSQL via Prisma for data, Auth.js for login, pg-boss for background jobs (no Redis),
Meilisearch for search, an S3-compatible bucket for files, and SMTP for email. Cash on delivery
only, test accounts everywhere, English only, no prescriptions. Source: `.claude/CLAUDE.md`.

---

## 2. Run it on your own machine

### Prerequisites

| Tool | Why | Get it |
| --- | --- | --- |
| Node.js 22.12 or newer | Runs the app (`package.json` → `engines.node`) | nodejs.org, or `nvm install 22` |
| npm | Comes with Node | — |
| Git | Clone the repo, branches | git-scm.com |
| Docker Desktop | Runs Postgres, Meilisearch, MinIO, Mailpit in one command | docker.com |

Docker is the one piece most likely to fail you (it needs to actually be *running*, not just
installed — on macOS open the Docker Desktop app and wait for its icon to settle before running
`docker compose up`). If Docker genuinely isn't available, `web/scripts/cloud-setup.sh` installs
the same four services directly on Linux without it (this is what the cloud agent session uses).

### Steps

```bash
git clone https://github.com/AsifAbu/bd-ecommerce-marketplace.git
cd bd-ecommerce-marketplace/web

cp .env.example .env
# open .env and replace AUTH_SECRET with: openssl rand -base64 32
# everything else in .env.example already matches docker-compose.yml; leave it as is

docker compose up -d                 # Postgres, Meilisearch, MinIO, Mailpit
npm install                          # also runs `prisma generate` (postinstall)
npx prisma migrate deploy            # create the tables
npm run seed                         # test users, 4 shops, products, policies
npm run dev                          # http://localhost:3000
```

In a second terminal, start the background worker (see §4 for why you need it):

```bash
npm run worker
```

Log in with password `Test@12345` for any seeded account (`admin@ecom.test`, `owner.tech@ecom.test`,
`customer.verified@ecom.test`, ...; full list in `web/e2e/support/auth.ts` and `web/README.md`).
The OTP code is always `123456` — `APP_MODE=test` in `.env` enables that and shows a banner saying so.

### Useful commands (all in `web/`)

| Command | Does |
| --- | --- |
| `npm run dev` | Start the app, hot reload |
| `npm run build && npm start` | Build and run like production |
| `npm run worker` | Start the background job worker (add `-- --demo` to send a test job) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; needs the services and a build/dev server running) |
| `npm run seed` | Reseed test data (refuses to run unless `APP_MODE=test`) |
| `npx prisma migrate dev` (`db:migrate`) | New migration while developing a feature branch |
| `npx prisma db push` (`db:push`) | Push schema changes to your branch's database without a migration file |
| `npx prisma migrate deploy` | Apply existing migrations (what you run on a fresh database) |

### Stopping / resetting

`docker compose down` stops the services; add `-v` to also delete their data (you'll need to
`migrate deploy` + `seed` again). `docker compose ps` shows what's running; service logs are
`docker compose logs -f <service>` (`postgres`, `meilisearch`, `minio`, `mailpit`).

---

## 3. Put it somewhere others can open a link (free tier)

This runs the whole thing on free hosting instead of Docker on your machine. **Not yet tried
end to end against this exact app** — treat it as a strong starting point, not a guarantee.
Five accounts, all free, no card needed for the first four:

| Piece | Replaces | Provider |
| --- | --- | --- |
| The web app | `npm run dev` / `npm start` | Render (Web Service) — Vercel's free tier can't run the worker below, so Render for both keeps it simple |
| The worker | `npm run worker` | Render (second Web Service, same repo) |
| PostgreSQL | `docker compose up postgres` | Neon |
| File storage | MinIO | Cloudflare R2 |
| Search | Meilisearch (Docker) | Meilisearch Cloud |
| Email | Mailpit | Mailtrap or Resend |

### 3.1 Database — Neon

1. neon.tech → sign up → **Create project** (region close to Singapore).
2. **Connect** → copy the connection string (`postgresql://...sslmode=require`). This is `DATABASE_URL`.
3. From your machine, apply the schema and seed it once (Render's free plan has no "run once" step):
   ```bash
   DATABASE_URL="<neon url>" npx prisma migrate deploy
   DATABASE_URL="<neon url>" npm run seed
   ```
   If this hangs or refuses migrations, use Neon's **direct** connection string (no `-pooler` in
   the host) for this step only — pooled connections don't support the session Prisma migrations need.

### 3.2 File storage — Cloudflare R2

1. Cloudflare dashboard → R2 → create two buckets: one for product photos (public), one for
   licence/NID documents (private).
2. R2 → **Manage API tokens** → create one with read/write access → note the Access Key ID and
   Secret Access Key.
3. `S3_ENDPOINT` = `https://<your-account-id>.r2.cloudflarestorage.com` (account id is on the R2
   dashboard). `S3_REGION` = `auto`.
4. Turn on public access for the public bucket (R2 → bucket → Settings), or photos won't load in
   the browser. Not verified against this app's image-URL code — check after first deploy.

### 3.3 Search — Meilisearch Cloud

Sign up at meilisearch.com/cloud → create a project → copy the URL into `MEILI_URL` and the
master key into `MEILI_MASTER_KEY`.

### 3.4 Email — Mailtrap or Resend

Mailtrap's free sandbox inbox is the closest thing to Mailpit (catches mail instead of sending
it, good for testing). Copy its SMTP host/port into `SMTP_HOST`/`SMTP_PORT`. The app's mailer
(`web/src/lib/mail.ts`) does not currently read an SMTP username/password — if your provider
requires one, that's a small code change needed first; not yet made.

### 3.5 The web app — Render

New → Web Service → connect the GitHub repo.

| Field | Value |
| --- | --- |
| Name | anything, e.g. `bd-ecommerce-marketplace` |
| Language | Node |
| Branch | `main` |
| Region | Singapore (closest to Bangladesh) |
| Root Directory | `web` |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npm start` |
| Instance type | **Free** ($0 / 0.1 CPU / 512 MB) |

Environment variables (Render → Environment):

```
NODE_VERSION=22
APP_MODE=test
OTP_DUMMY_ENABLED=true
AUTH_TRUST_HOST=true
DATABASE_URL=<neon connection string>
AUTH_SECRET=<Render's "Generate" button>
AUTH_URL=<leave blank, deploy once, then set to https://<your-app>.onrender.com and redeploy>
MEILI_URL=<meilisearch cloud url>
MEILI_MASTER_KEY=<its master key>
S3_ENDPOINT=<r2 endpoint>
S3_REGION=auto
S3_ACCESS_KEY_ID=<r2 key>
S3_SECRET_ACCESS_KEY=<r2 secret>
S3_BUCKET_PUBLIC=<r2 public bucket name>
S3_BUCKET_PRIVATE=<r2 private bucket name>
SMTP_HOST=<mailtrap host>
SMTP_PORT=<mailtrap port>
EMAIL_FROM=Dokan <no-reply@ecom.test>
```
(`DBID` can stay unset — test mode shows a placeholder instead of refusing to start.)

### 3.6 The worker — a second Render service

New → Web Service → same repo → Root Directory `web` → Start Command `npm run worker` → same
environment variables as §3.5. Render's **free** tier has no always-on background-worker type —
a free *web* service sleeps after ~15 minutes idle, and a sleeping worker does nothing. Paying
$7/month for this one service (keep the main app free) gets you an always-on worker; skipping it
entirely is fine for a quick look, with the gaps in §4 below.

---

## 4. Every outside tool: what it's for, what breaks if it's missing

| Tool | What it does here | If you don't set it up |
| --- | --- | --- |
| **PostgreSQL** | All data: users, shops, products, orders | Nothing runs at all — this is the one truly required piece |
| **Prisma** | Typed database access, migrations | N/A, it's part of the app, not an external service |
| **Auth.js** | Login sessions (JWT) | N/A, part of the app |
| **pg-boss** | Job queue, stored as tables inside Postgres — no separate service, just needs `npm run worker` running | See the worker row below; pg-boss itself needs nothing extra once Postgres exists |
| **The worker** (`npm run worker` / a second Render service) | Runs everything on a timer or queue: order-confirmation emails, search re-indexing after a product is added/edited, the 48h order-handover check, returns/complaints escalation, nightly seller-score recalculation, medicine-licence expiry, guest-cart cleanup | Login, browsing, checkout and signup/reset emails still work (those are sent directly by the web app). But: **order confirmations never send**, **new/edited products never become searchable**, and every one of the Bangladesh-guideline time limits (handover, returns, complaints, licence expiry) silently stops being enforced. Full list and detail in `web/src/lib/jobs/handlers.ts`. |
| **Meilisearch** | Fast, typo-tolerant search with filters | Search falls back to a plain Postgres query (README confirms this for local dev); filters/facets degrade |
| **MinIO (local) / Cloudflare R2 (hosted)** | Stores product photos, shop licence documents, NID photos | Products show a placeholder colour instead of a photo; uploads fail with a clear error message instead of crashing |
| **Mailpit (local) / Mailtrap / Resend (hosted)** | Catches/sends email: verification links, password reset, staff invites, order notifications | Those emails are never delivered (locally they just vanish into nothing if Mailpit isn't running; hosted, with no SMTP provider, sending throws) |
| **Docker Compose** | Runs Postgres/Meilisearch/MinIO/Mailpit together locally with one command | You'd need to install and run each manually (`web/scripts/cloud-setup.sh` does this without Docker, for Linux cloud sessions) |
| **Playwright** | End-to-end browser tests | Nothing breaks in the app itself — only `npm run test:e2e` has nothing to run |
| **Render** (hosted) | Runs the web app and the worker as always-on (or free-but-sleeping) processes | — |
| **Neon** (hosted) | Hosted Postgres with a free tier that doesn't expire | Render's *own* free Postgres expires after 30 days — don't use it for anything you want to keep |

---

## 5. What is deliberately not built or not set up yet, and why

Pulled from `.claude/CLAUDE.md` (keep that file as the source; this is a snapshot).

**Not built (planned for later releases):**
- Online payments, courier integration, Bengali UI — R2.
- US-054 seller sales/payout *reports* (the payouts page and API exist; downloadable reports don't).
- US-046 product matching (letting a new listing point at an existing catalog entry).
- Virtual try-on (US-060–063) — R3, after the product has traction; try-on provider (paid API vs
  self-hosted) is still an open question.

**Not set up, on purpose, because this is pre-release/test:**
- Real SMS provider — dummy OTP `123456` is used everywhere instead.
- Production medicine-licence verification — any uploaded file is accepted in test mode.
- A real compliance officer / DBID — test mode shows a placeholder.
- Final commission rate and fake-order limits — not finalised.
- A courier merchant account — no courier integration yet (R1 is cash on delivery, seller/platform
  handles delivery logistics outside the app).
- Removing seed data, reaching 100 active shops, deciding on prescription uploads (currently: no
  prescription upload, customers just buy the medicine), confirming the Basic seller tier is legal
  under the guidelines — all pre-release checklist items, not yet actioned.

---

## 6. If you're setting this up after a long break

1. Read `.claude/CLAUDE.md` top to bottom first — it has the current status and the open items,
   which this file does not duplicate.
2. Follow §2 above to get it running locally.
3. Check `git log --oneline -20` on `main` and compare against the status in `.claude/CLAUDE.md` —
   if they disagree, trust the git log and update CLAUDE.md.
4. Only go to §3 (hosting) if you actually need a shareable link; it's slower to set up and has
   more moving parts than just running it locally.

**Not checked when writing this:** whether the R2 public-bucket image URLs actually work without
a code change, and whether Mailtrap/Resend need SMTP credentials the current mailer doesn't send.
Both are flagged inline above — confirm them the first time you actually deploy.
