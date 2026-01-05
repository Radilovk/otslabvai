#!/bin/bash

# Script to upload backend JSON files to Cloudflare KV using wrangler
# Usage: ./upload-backend-to-kv.sh

set -e

KV_NAMESPACE="PAGE_CONTENT"

echo "🚀 Uploading backend files to Cloudflare KV..."
echo ""

# Upload products.json
if [ -f "backend/products.json" ]; then
    echo "📤 Uploading backend/products.json to 'products' key..."
    wrangler kv:key put --binding="$KV_NAMESPACE" "products" --path="backend/products.json"
    echo "✅ Uploaded products.json"
else
    echo "⚠️  File not found: backend/products.json, skipping..."
fi

# Upload page_content.json
if [ -f "backend/page_content.json" ]; then
    echo "📤 Uploading backend/page_content.json to 'page_content' key..."
    wrangler kv:key put --binding="$KV_NAMESPACE" "page_content" --path="backend/page_content.json"
    echo "✅ Uploaded page_content.json"
else
    echo "⚠️  File not found: backend/page_content.json, skipping..."
fi

echo ""
echo "✨ Backend upload complete!"
echo ""
echo "Next steps:"
echo "1. The frontend will now load products from /products endpoint"
echo "2. Refresh your browser to see the changes"
