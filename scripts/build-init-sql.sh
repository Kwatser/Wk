#!/usr/bin/env bash
# Regenerate prisma/init.sql = table definitions (DDL) + seed data.
# Run from the repo root: bash scripts/build-init-sql.sh
set -euo pipefail

OUT="prisma/init.sql"
TMP_DDL="$(mktemp)"
TMP_DATA="$(mktemp)"
trap 'rm -f "$TMP_DDL" "$TMP_DATA"' EXIT

# 1. Table definitions, straight from the Prisma schema (no database needed).
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$TMP_DDL"

# 2. Seed data (teams, matches, settings) from the shared seed data.
npx tsx scripts/generate-init-sql.ts > "$TMP_DATA"

{
  echo "-- WK Pool Predictor — one-shot database setup."
  echo "-- Paste this whole file into your database's SQL editor (e.g. Neon) and run it."
  echo "-- It creates the tables and loads 31 teams + 14 example matches."
  echo "-- Afterwards, open the app and click \"Regenerate all predictions\" on the dashboard."
  echo ""
  cat "$TMP_DDL"
  echo ""
  cat "$TMP_DATA"
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)."
