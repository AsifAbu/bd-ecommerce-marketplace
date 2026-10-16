#!/usr/bin/env bash
# Prepares a fresh cloud session (claude.ai/code) to build and test the app without Docker.
# Installs and starts Postgres, Meilisearch, MinIO and Mailpit, then installs, migrates and seeds.
# Safe to run more than once. Services that can't be downloaded are skipped with a warning:
# unit tests still run (they don't need services); only db, e2e and upload flows need them.
set -uo pipefail
cd "$(dirname "$0")/.."            # web/
BIN="$HOME/.local/bin"; mkdir -p "$BIN" /tmp/svc
export PATH="$BIN:$PATH"
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && SUDO="sudo"
warn() { echo "WARN: $*" >&2; }

# Postgres (required for db:push, migrations, seed, e2e)
if ! command -v psql >/dev/null; then
  $SUDO apt-get update -qq && $SUDO apt-get install -y -qq postgresql >/dev/null || warn "could not install Postgres"
fi
$SUDO service postgresql start >/dev/null 2>&1 || warn "could not start Postgres"
$SUDO -u postgres psql -qtc "SELECT 1 FROM pg_roles WHERE rolname='ecom'" | grep -q 1 \
  || $SUDO -u postgres psql -qc "CREATE ROLE ecom LOGIN SUPERUSER PASSWORD 'ecom'" || true
$SUDO -u postgres psql -qtc "SELECT 1 FROM pg_database WHERE datname='ecom'" | grep -q 1 \
  || $SUDO -u postgres createdb -O ecom ecom || true

# Meilisearch (search; used from Sprint 5)
if [ ! -x "$BIN/meilisearch" ]; then
  (cd "$BIN" && curl -fsSL https://install.meilisearch.com | sh >/dev/null 2>&1) || warn "could not download Meilisearch"
fi
pgrep -x meilisearch >/dev/null || { [ -x "$BIN/meilisearch" ] && nohup "$BIN/meilisearch" --master-key dev-master-key-change-me-0123456789 \
  --db-path /tmp/svc/meili --http-addr 127.0.0.1:7700 >/tmp/svc/meili.log 2>&1 & }

# MinIO (private file storage for licences and documents)
if [ ! -x "$BIN/minio" ]; then
  curl -fsSL -o "$BIN/minio" https://dl.min.io/server/minio/release/linux-amd64/minio && chmod +x "$BIN/minio" || warn "could not download MinIO"
fi
pgrep -x minio >/dev/null || { [ -x "$BIN/minio" ] && MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
  nohup "$BIN/minio" server /tmp/svc/minio --address 127.0.0.1:9100 --console-address 127.0.0.1:9101 >/tmp/svc/minio.log 2>&1 & }

# Mailpit (catches test emails; UI on :8025)
if [ ! -x "$BIN/mailpit" ]; then
  curl -fsSL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh | INSTALL_PATH="$BIN" bash >/dev/null 2>&1 || warn "could not download Mailpit"
fi
pgrep -x mailpit >/dev/null || { [ -x "$BIN/mailpit" ] && nohup "$BIN/mailpit" >/tmp/svc/mailpit.log 2>&1 & }

# App: env, dependencies, database
[ -f .env ] || sed "s/^AUTH_SECRET=.*/AUTH_SECRET=$(openssl rand -hex 32)/" .env.example > .env
npm ci --no-audit --no-fund
npx prisma migrate deploy && npm run seed || warn "database not ready: migrate/seed skipped"
echo "Cloud setup done. Check: npm run lint && npm run typecheck && npm test"
