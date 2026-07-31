#!/bin/bash
# Store Fitness1 B2B API key in Cloudflare KV + Worker secret.
# Usage:
#   export FITNESS1_API_KEY='your-key-from-fitness1'
#   ./set-fitness1-key.sh
set -e

KV_NAMESPACE="PAGE_CONTENT"
TOKEN_KEY="fitness1_api_key"

if [ -z "$FITNESS1_API_KEY" ]; then
    echo "❌ Set FITNESS1_API_KEY environment variable first."
    echo "   export FITNESS1_API_KEY='your-key'"
    exit 1
fi

TEMP_FILE=$(mktemp)
chmod 600 "$TEMP_FILE"
printf '%s' "$FITNESS1_API_KEY" > "$TEMP_FILE"

echo "🔐 Storing Fitness1 API key in KV..."
npx wrangler kv key put --namespace-id=d220db696e414b7cb3da2b19abd53d0f "$TOKEN_KEY" --path="$TEMP_FILE"
KV_EXIT=$?
rm -f "$TEMP_FILE"

if [ $KV_EXIT -ne 0 ]; then
    echo "❌ KV update failed. Ensure CLOUDFLARE_API_TOKEN is set or run 'npx wrangler login'"
    exit 1
fi
echo "✅ KV key stored as '$TOKEN_KEY'"

echo "🔐 Updating Worker secret FITNESS1_API_KEY..."
printf '%s' "$FITNESS1_API_KEY" | npx wrangler secret put FITNESS1_API_KEY
echo "✅ Worker secret updated"
echo ""
echo "Test: curl -s https://port.radilov-k.workers.dev/portfolio/fitness1-check"
echo "Sync: curl -X POST https://port.radilov-k.workers.dev/portfolio/sync"
