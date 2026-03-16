#!/bin/bash
# Backfill author/ISBN metadata for all manifest items without an author.
# Calls the backfill-authors Edge Function in batches until all books are processed.
#
# Usage: bash scripts/backfill-authors.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
URL=$(grep VITE_SUPABASE_URL "$SCRIPT_DIR/.env.local" | cut -d= -f2)
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY "$SCRIPT_DIR/.env.local" | cut -d= -f2)

if [ -z "$URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Error: Could not read VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY from .env.local"
  exit 1
fi

BATCH=0
TOTAL_AUTHORS=0
TOTAL_ISBNS=0
TOTAL_PROCESSED=0

echo "Starting author/ISBN backfill..."

while true; do
  BATCH=$((BATCH + 1))

  result=$(curl -s --max-time 120 -X POST "$URL/functions/v1/backfill-authors" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d '{"batch_size": 5}')

  processed=$(echo "$result" | grep -o '"processed":[0-9]*' | cut -d: -f2)
  authors=$(echo "$result" | grep -o '"authorsFound":[0-9]*' | cut -d: -f2)
  isbns=$(echo "$result" | grep -o '"isbnsFound":[0-9]*' | cut -d: -f2)
  remaining=$(echo "$result" | grep -o '"remaining":[0-9]*' | cut -d: -f2)

  if [ -z "$processed" ] || [ "$processed" = "0" ]; then
    echo ""
    echo "Done! No more books to process."
    break
  fi

  TOTAL_PROCESSED=$((TOTAL_PROCESSED + processed))
  TOTAL_AUTHORS=$((TOTAL_AUTHORS + ${authors:-0}))
  TOTAL_ISBNS=$((TOTAL_ISBNS + ${isbns:-0}))

  echo "Batch $BATCH: processed=$processed authors=${authors:-0} isbns=${isbns:-0} remaining=${remaining:-?}"

  # Show individual results
  echo "$result" | grep -oP '"title"\s*:\s*"[^"]*"' | sed 's/"title"\s*:\s*"/  - /;s/"$//' || true

  if [ "${remaining:-0}" = "0" ]; then
    echo ""
    echo "All books processed!"
    break
  fi

  # Small delay between batches
  sleep 2

  # Safety limit
  if [ "$BATCH" -ge 100 ]; then
    echo "Reached 100 batch limit. Re-run to continue."
    break
  fi
done

echo ""
echo "Summary:"
echo "  Total processed: $TOTAL_PROCESSED"
echo "  Authors found: $TOTAL_AUTHORS"
echo "  ISBNs found: $TOTAL_ISBNS"
