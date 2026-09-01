#!/usr/bin/env bash
# Hermes bootstrap script — one-shot setup for GenLab on a fresh machine.
#
# Usage (from the unpacked GenLab/ root):
#   bash scripts/hermes-start.sh          # install + generate + dev server
#   bash scripts/hermes-start.sh build    # install + generate + prod build + start
#
# Prerequisites:
#   - Node 20+ (recommend 22+) and npm/pnpm/bun (auto-detected in that order)
#   - Internet access for `install` (Prisma + ZAI SDK + Next.js + three.js)
#   - Optional: ZAI_API_KEY env var if running outside Z.ai infra
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Pick a package manager — prefer bun (matches dev environment), fall back to npm.
if command -v bun >/dev/null 2>&1; then
  PKG="bun"
  INSTALL="bun install"
  RUN="bun run"
  EXEC="bunx"
elif command -v pnpm >/dev/null 2>&1; then
  PKG="pnpm"
  INSTALL="pnpm install"
  RUN="pnpm"
  EXEC="pnpm dlx"
elif command -v npm >/dev/null 2>&1; then
  PKG="npm"
  INSTALL="npm install"
  RUN="npm run"
  EXEC="npx"
else
  echo "ERROR: no bun/pnpm/npm found in PATH. Install Node 20+ first." >&2
  exit 1
fi

echo "==> Package manager: $PKG"
echo "==> Project root:   $ROOT"

# 1. .env
if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "==> Created .env from .env.example (edit if paths differ)"
  else
    echo "DATABASE_URL=file:$ROOT/db/custom.db" > "$ROOT/.env"
    echo "==> Created minimal .env"
  fi
else
  echo "==> .env exists, leaving as-is"
fi

# 2. Install deps
echo "==> Installing dependencies ($INSTALL)…"
$INSTALL

# 3. Prisma client
echo "==> Generating Prisma client…"
$EXEC prisma generate

# 4. (Optional) DB push — only if DATABASE_URL points to a non-existent file.
#    The bundled db/custom.db already has the schema applied.
DB_PATH="$ROOT/db/custom.db"
if [ ! -f "$DB_PATH" ]; then
  echo "==> db/custom.db missing — running prisma db push (creates fresh DB)…"
  $EXEC prisma db push
else
  echo "==> Using bundled db/custom.db ($(du -h "$DB_PATH" | cut -f1))"
fi

# 5. Run
MODE="${1:-dev}"
case "$MODE" in
  dev)
    echo "==> Starting dev server on http://localhost:3000 …"
    exec $RUN dev
    ;;
  build)
    echo "==> Production build…"
    $RUN build
    echo "==> Starting prod server on http://localhost:3000 …"
    exec $RUN start
    ;;
  *)
    echo "Usage: bash scripts/hermes-start.sh [dev|build]" >&2
    exit 1
    ;;
esac
