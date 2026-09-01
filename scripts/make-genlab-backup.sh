#!/usr/bin/env bash
# Full backup of GenLab project (gene-driven invention & patent pipeline)
# Includes source code, prisma schema, SQLite DB (sessions/genes/inventions/
# hardware/schematics), and uploads — excludes only heavy/regenerable stuff
# (node_modules, .next, .git, dev logs).
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
PROJ=/home/z/my-project
OUT_DIR="$PROJ/download"
BACKUP_NAME="GenLab-full-backup-$TS"
BACKUP_TAR="$OUT_DIR/$BACKUP_NAME.tar.gz"
STAGING="/tmp/genlab-staging-$$"

mkdir -p "$STAGING/GenLab"

# Write RESTORE.md
cat > "$STAGING/GenLab/RESTORE.md" <<'EOF'
# GenLab — Restore Instructions

This archive contains the full **GenLab** project (gene-driven invention & patent pipeline).

## What's inside
- `GenLab/` — full project tree (src, prisma, public, configs, db/)
  - Includes: SQLite database (`db/custom.db`) with all sessions, genes, inventions, hardware, schematics
  - Excludes: `node_modules/`, `.next/`, `.git/`, `dev.log`, `server.log`, `tsconfig.tsbuildinfo`

## Restore procedure
```bash
# 1. Extract
mkdir -p ~/genlab-restore && cd ~/genlab-restore
tar -xzf GenLab-full-backup-YYYYMMDD-HHMMSS.tar.gz
cd GenLab

# 2. Install deps
bun install   # or: npm install / pnpm install

# 3. Env vars
cp .env.example .env  # or set ZAI_API_KEY=... manually

# 4. Database (SQLite) — already included in db/custom.db
bunx prisma generate
# Run `bunx prisma db push` ONLY if you want a fresh empty DB; skip to keep the bundled one.

# 5. Run dev server
bun run dev            # http://localhost:3000

# 6. (Optional) Production build
bun run build
bun run start
```

## Architecture recap
- Next.js 16 App Router + TypeScript + Prisma 6 (SQLite)
- 9-agent SSE pipeline: Problem Analyst → Gene Extractor → AHI Ethicist →
  Fusion Strategist → System Architect → Hardware Architect → Schematic
  Prompt Builder → Patent Composer
- 6 critical pipeline layers: Teoria → Repozytoria → Geny → AHI → Fuzja → Patent
- Geny = real GitHub repositories (repo-first, not theoretical)
- Patent framing: every invention includes claim + prior art + novelty
- Hardware phase: 2-3 BOM variants per invention (Budget DIY / Performance / Pro Lab)
- Sessions view: full session detail with full gene cards (repo URL, language,
  license, stars, description, AHI breakdown, reasoning), archive + hard-delete

## History
- v1: AHI Innovation Lab (initial 7-stage pipeline)
- v2: Engine (genetic reconceptualization + patent framing + SSE heartbeat fix)
- v3: GenLab (final naming — gene-driven invention & patent pipeline)
EOF

# Copy project files into staging (with excludes).
# NOTE: db/*.db is INCLUDED this time — previous backups skipped it, which
# meant restoring a backup lost all session/gene/invention data. The SQLite
# file is tiny (~120 KB) and is the whole point of backing up.
rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='tsconfig.tsbuildinfo' \
  --exclude='tool-results' \
  --exclude='download' \
  --exclude='scripts/_restore_staging_*' \
  --exclude='*.log' \
  "$PROJ/" "$STAGING/GenLab/"

# Tar it up
tar -czf "$BACKUP_TAR" -C "$STAGING" GenLab

# Report
SIZE=$(du -h "$BACKUP_TAR" | cut -f1)
FILES=$(tar -tzf "$BACKUP_TAR" | wc -l)
echo "Backup created: $BACKUP_TAR"
echo "  Size: $SIZE"
echo "  Files: $FILES"

# Cleanup staging
rm -rf "$STAGING"

# SHA256 checksum
cd "$OUT_DIR"
sha256sum "$(basename "$BACKUP_TAR")" > "$(basename "$BACKUP_TAR").sha256"
echo "Checksum: $(basename "$BACKUP_TAR").sha256"
