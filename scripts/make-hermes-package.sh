#!/usr/bin/env bash
# Build a clean deployable package of GenLab for the Hermes agent.
# Output: download/GenLab-for-hermes-<timestamp>.tar.gz
#
# Includes:
#   - Full src/ + prisma/ + public/ + db/custom.db (with real data)
#   - HERMES.md (agent brief)
#   - .env.example
#   - scripts/hermes-start.sh (bootstrap)
#   - scripts/make-genlab-backup.sh (for future backups)
#   - All configs (package.json, next.config.ts, tsconfig.json, tailwind, postcss, etc.)
#
# Excludes:
#   - node_modules/  (Hermes installs fresh)
#   - .next/         (build artifacts)
#   - .git/          (VCS)
#   - tool-results/  (transient)
#   - download/      (other backups — avoids recursive bloat)
#   - skills/        (Z.ai internal skills, not part of GenLab)
#   - *.log           (dev/server logs)
#   - tsconfig.tsbuildinfo
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
PROJ=/home/z/my-project
OUT_DIR="$PROJ/download"
PKG_NAME="GenLab-for-hermes-$TS"
PKG_TAR="$OUT_DIR/$PKG_NAME.tar.gz"
STAGING="/tmp/genlab-hermes-staging-$$"

mkdir -p "$STAGING/GenLab"

# Copy project files (with excludes)
rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='tsconfig.tsbuildinfo' \
  --exclude='tool-results' \
  --exclude='download' \
  --exclude='skills' \
  --exclude='upload' \
  --exclude='*.log' \
  --exclude='.env' \
  "$PROJ/" "$STAGING/GenLab/"

# Sanity check
echo "==> Staging content:"
ls -la "$STAGING/GenLab/" | head -20

# Verify HERMES.md exists
if [ ! -f "$STAGING/GenLab/HERMES.md" ]; then
  echo "ERROR: HERMES.md missing in staging" >&2
  exit 1
fi
if [ ! -f "$STAGING/GenLab/.env.example" ]; then
  echo "ERROR: .env.example missing in staging" >&2
  exit 1
fi
if [ ! -f "$STAGING/GenLab/scripts/hermes-start.sh" ]; then
  echo "ERROR: scripts/hermes-start.sh missing in staging" >&2
  exit 1
fi
if [ ! -f "$STAGING/GenLab/db/custom.db" ]; then
  echo "ERROR: db/custom.db missing — Hermes needs the real data" >&2
  exit 1
fi

# Tar
tar -czf "$PKG_TAR" -C "$STAGING" GenLab

# Report
SIZE=$(du -h "$PKG_TAR" | cut -f1)
FILES=$(tar -tzf "$PKG_TAR" | wc -l)
echo ""
echo "==> Package created: $PKG_TAR"
echo "    Size:  $SIZE"
echo "    Files: $FILES"
echo "    SHA256: $(cd "$OUT_DIR" && sha256sum "$(basename "$PKG_TAR")" | tee "$(basename "$PKG_TAR").sha256" | cut -d' ' -f1)"

# Cleanup staging
rm -rf "$STAGING"

echo ""
echo "==> Quick restore test (extract to /tmp):"
TEST_DIR="/tmp/genlab-hermes-test-$$"
mkdir -p "$TEST_DIR"
tar -xzf "$PKG_TAR" -C "$TEST_DIR"
echo "    Extracted to: $TEST_DIR/GenLab"
echo "    Top-level files:"
ls "$TEST_DIR/GenLab/" | sed 's/^/      /'
echo ""
echo "    Hermes instructions (first 5 lines of HERMES.md):"
head -5 "$TEST_DIR/GenLab/HERMES.md" | sed 's/^/      /'
rm -rf "$TEST_DIR"

echo ""
echo "==> Done. Provide Hermes with: $PKG_TAR"
