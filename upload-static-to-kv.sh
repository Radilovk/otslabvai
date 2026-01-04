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

echo ""
echo "✨ Upload complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the worker: npm run deploy"
echo "2. Visit your worker URL to see the frontend"
