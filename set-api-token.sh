#!/bin/bash

# Script to set GitHub API token in Cloudflare KV
# Usage: ./set-api-token.sh YOUR_GITHUB_TOKEN
# or: ./set-api-token.sh (will prompt for token)

set -e

KV_NAMESPACE="PAGE_CONTENT"
TOKEN_KEY="api_token"

if [ -z "$1" ]; then
    echo "GitHub API Token Configuration"
    echo "================================"
    echo ""
    echo "Enter your GitHub Personal Access Token:"
    echo "(The token should have 'repo' permissions)"
    read -s GITHUB_TOKEN
    echo ""
else
    GITHUB_TOKEN="$1"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Token cannot be empty"
    exit 1
fi

# Validate token format
if [[ ! "$GITHUB_TOKEN" =~ ^(ghp_|github_pat_) ]]; then
    echo "⚠️  Warning: Token doesn't start with 'ghp_' or 'github_pat_'"
    echo "GitHub Personal Access Tokens typically start with one of these prefixes."
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 1
    fi
fi

echo "🔐 Setting API token in Cloudflare KV..."

# Use wrangler to set the KV value
echo "$GITHUB_TOKEN" | wrangler kv:key put --binding="$KV_NAMESPACE" "$TOKEN_KEY" --path=-

if [ $? -eq 0 ]; then
    echo "✅ API token successfully stored in KV!"
    echo ""
    echo "The token is now available for the admin panel to use when uploading images."
    echo "You can test it by:"
    echo "  1. Opening the admin panel"
    echo "  2. Uploading a product image"
    echo "  3. The token should be used automatically without prompting"
else
    echo "❌ Failed to set API token"
    exit 1
fi
