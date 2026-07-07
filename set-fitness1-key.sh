#!/bin/bash
# Store Fitness1 B2B API key in Cloudflare KV (same pattern as set-api-token.sh)
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
echo -n "$FITNESS1_API_KEY" > "$TEMP_FILE"

echo "🔐 Storing Fitness1 API key in KV..."
npx wrangler kv key put --namespace-id=d220db696e414b7cb3da2b19abd53d0f "$TOKEN_KEY" --path="$TEMP_FILE"
EXIT_CODE=$?
rm -f "$TEMP_FILE"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Fitness1 API key stored in KV as '$TOKEN_KEY'"
else
    echo "❌ Failed. Ensure CLOUDFLARE_API_TOKEN is set or run 'npx wrangler login'"
    exit 1
fi
