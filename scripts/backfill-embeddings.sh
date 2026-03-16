#!/bin/bash
# Backfill semantic embeddings for all content tables.
# Run this script to generate embeddings for all existing rows.
# It calls the embed Edge Function repeatedly until all rows are embedded.
#
# Usage: bash scripts/backfill-embeddings.sh [table_name]
# Example: bash scripts/backfill-embeddings.sh manifest_summaries
#
# Without arguments, processes all tables.
# The script prints progress every 20 batches and stops when no rows remain.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY "$SCRIPT_DIR/.env.local" | cut -d= -f2)
URL=$(grep VITE_SUPABASE_URL "$SCRIPT_DIR/.env.local" | cut -d= -f2)

if [ -z "$ANON_KEY" ] || [ -z "$URL" ]; then
  echo "Error: Could not read VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_URL from .env.local"
  exit 1
fi

TABLE_ARG=""
if [ -n "$1" ]; then
  TABLE_ARG="\"table\": \"$1\","
  echo "Backfilling table: $1"
else
  echo "Backfilling all tables"
fi

BATCH=0
TOTAL_PROCESSED=0

while true; do
  BATCH=$((BATCH + 1))

  result=$(curl -s -X POST "$URL/functions/v1/embed" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d "{$TABLE_ARG \"batch_size\": 200}")

  processed=$(echo "$result" | grep -o '"processed":[0-9]*' | cut -d: -f2)
  failed=$(echo "$result" | grep -o '"failed":[0-9]*' | cut -d: -f2)

  if [ -z "$processed" ] || [ "$processed" = "0" ]; then
    echo "Done! No more rows to embed."
    echo "Total processed across all batches: $TOTAL_PROCESSED"
    break
  fi

  TOTAL_PROCESSED=$((TOTAL_PROCESSED + processed))

  if [ $((BATCH % 20)) -eq 0 ] || [ "$failed" != "0" ]; then
    echo "Batch $BATCH: processed=$processed failed=$failed total=$TOTAL_PROCESSED | $result"
  fi

  # Safety: stop after 5000 batches (1M rows)
  if [ "$BATCH" -ge 5000 ]; then
    echo "Reached 5000 batch limit. Re-run to continue."
    break
  fi
done
