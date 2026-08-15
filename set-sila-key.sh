#!/bin/bash
# Store Sila.bg Distro API token in Cloudflare KV + Worker secret.
# Usage:
#   export SILA_API_TOKEN='your-token-from-sila-bg-profile'
#   ./set-sila-key.sh
set -e

KV_NAMESPACE_ID="d220db696e414b7cb3da2b19abd53d0f"
TOKEN_KEY="sila_api_token"

if [ -z "$SILA_API_TOKEN" ]; then
    echo "❌ Set SILA_API_TOKEN environment variable first."
    echo "   export SILA_API_TOKEN='your-token'"
    exit 1
fi

TEMP_FILE=$(mktemp)
chmod 600 "$TEMP_FILE"
printf '%s' "$SILA_API_TOKEN" > "$TEMP_FILE"

echo "🔐 Storing Sila API token in KV..."
npx wrangler kv key put --namespace-id="$KV_NAMESPACE_ID" "$TOKEN_KEY" --path="$TEMP_FILE" --remote
KV_EXIT=$?
rm -f "$TEMP_FILE"

if [ $KV_EXIT -ne 0 ]; then
    echo "❌ KV update failed. Ensure CLOUDFLARE_API_TOKEN is set or run 'npx wrangler login'"
    exit 1
fi
echo "✅ KV key stored as '$TOKEN_KEY'"

echo "🔐 Updating Worker secret SILA_API_TOKEN..."
printf '%s' "$SILA_API_TOKEN" | npx wrangler secret put SILA_API_TOKEN
echo "✅ Worker secret updated"
echo ""
echo "Test: curl -s https://port.radilov-k.workers.dev/portfolio/sila-key-status"
echo "Sync: curl -X POST https://port.radilov-k.workers.dev/portfolio/sync"
