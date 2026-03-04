#!/bin/bash

# Script to upload static files to Cloudflare KV using wrangler
# Usage: ./upload-static-to-kv.sh

set -e

KV_NAMESPACE="PAGE_CONTENT"

echo "🚀 Uploading static files to Cloudflare KV..."
echo ""

# Array of files to upload
declare -a files=(
    "index.html"
    "index.js"
    "index.css"
    "config.js"
    "admin.html"
    "admin.js"
    "admin.css"
    "checkout.html"
    "life.html"
    "life.js"
    "life.css"
    "quest.html"
    "questionnaire.js"
    "questionnaire.css"
    "product.html"
    "product.js"
    "about-us.html"
    "contact.html"
    "policy.html"
    "terms.html"
    "shipping.html"
    "404.html"
    "robots.txt"
    "sitemap.xml"
)

# Upload each file
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "📤 Uploading $file..."
        wrangler kv:key put --binding="$KV_NAMESPACE" "static_$file" --path="$file"
        echo "✅ Uploaded $file"
    else
        echo "⚠️  File not found: $file, skipping..."
    fi
done

# Upload backend/page_content.json as both the static fallback and, if not already set,
# the live 'page_content' key used by the worker.
if [ -f "backend/page_content.json" ]; then
    echo "📤 Uploading backend/page_content.json as static fallback..."
    wrangler kv:key put --binding="$KV_NAMESPACE" "static_backend_page_content.json" --path="backend/page_content.json"
    echo "✅ Uploaded backend/page_content.json as static fallback"

    echo "📤 Seeding live 'page_content' key from backend/page_content.json (only if not set)..."
    EXISTING=$(wrangler kv:key get --binding="$KV_NAMESPACE" "page_content" 2>/dev/null || true)
    if [ -z "$EXISTING" ]; then
        wrangler kv:key put --binding="$KV_NAMESPACE" "page_content" --path="backend/page_content.json"
        echo "✅ Seeded 'page_content' from backend/page_content.json"
    else
        echo "ℹ️  'page_content' already set in KV, skipping seed (admin changes preserved)"
    fi
else
    echo "⚠️  backend/page_content.json not found, skipping..."
fi

# Upload backend/life_page_content.json as both the static fallback and, if not already set,
# the live 'life_page_content' key used by the worker.
if [ -f "backend/life_page_content.json" ]; then
    echo "📤 Uploading backend/life_page_content.json as static fallback..."
    wrangler kv:key put --binding="$KV_NAMESPACE" "static_backend_life_page_content.json" --path="backend/life_page_content.json"
    echo "✅ Uploaded backend/life_page_content.json as static fallback"

    echo "📤 Seeding live 'life_page_content' key from backend/life_page_content.json (only if not set)..."
    EXISTING_LIFE=$(wrangler kv:key get --binding="$KV_NAMESPACE" "life_page_content" 2>/dev/null || true)
    if [ -z "$EXISTING_LIFE" ]; then
        wrangler kv:key put --binding="$KV_NAMESPACE" "life_page_content" --path="backend/life_page_content.json"
        echo "✅ Seeded 'life_page_content' from backend/life_page_content.json"
    else
        echo "ℹ️  'life_page_content' already set in KV, skipping seed (admin changes preserved)"
    fi
else
    echo "⚠️  backend/life_page_content.json not found, skipping..."
fi

echo ""
echo "✨ Upload complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the worker: npm run deploy"
echo "2. Visit your worker URL to see the frontend"
