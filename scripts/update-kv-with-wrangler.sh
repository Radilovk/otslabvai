#!/bin/bash

# Script to update Cloudflare KV with the correct page content using wrangler
# This fixes the issue where BIOCODE content is served instead of ОТСЛАБВАНЕ content

echo "🚀 Updating page content in Cloudflare KV using wrangler..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Get the KV namespace ID from wrangler.toml
KV_ID=$(grep -A 3 'binding = "PAGE_CONTENT"' wrangler.toml | grep 'id = ' | head -1 | sed 's/.*"\(.*\)".*/\1/')

if [ -z "$KV_ID" ]; then
    echo "❌ Error: Could not find PAGE_CONTENT KV namespace ID in wrangler.toml"
    exit 1
fi

echo "📦 KV Namespace ID: $KV_ID"
echo "📝 Uploading content from page_content_mock.json..."

# Upload the mock data to KV
wrangler kv:key put --namespace-id="$KV_ID" "page_content" --path="page_content_mock.json"

if [ $? -eq 0 ]; then
    echo "✅ Success! Page content updated."
    echo ""
    echo "📋 The following content was uploaded:"
    cat page_content_mock.json | jq -r '.settings | "   Site Name: \(.site_name)\n   Site Slogan: \(.site_slogan)"'
else
    echo "❌ Error: Failed to update KV content"
    exit 1
fi
