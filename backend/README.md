# Backend Files for Cloudflare KV Upload

This folder contains the JSON files that should be uploaded to Cloudflare Workers KV storage.

## KV Namespace Binding

The worker uses a KV namespace binding called `PAGE_CONTENT`.

## Files to Upload

Upload each JSON file to the KV store with the following keys:

1. **page_content.json** → KV key: `page_content`
   - Contains the complete site structure: settings, navigation, page_content array, and footer
   - This is the main content file that controls the entire site appearance
   - Includes all product categories and their products

2. **orders.json** → KV key: `orders`
   - Contains order records
   - Updated when customers place orders through the questionnaire

3. **products.json** → (Optional, currently not used by worker)
   - Alternative product structure
   - Kept for reference

4. **site_content.json** → (Optional, currently not used by worker)
   - Simplified content without products
   - Kept for reference

## Upload Instructions

Using Wrangler CLI:

```bash
# Upload page_content (main content file)
wrangler kv:key put --binding=PAGE_CONTENT "page_content" --path=backend/page_content.json

# Upload orders
wrangler kv:key put --binding=PAGE_CONTENT "orders" --path=backend/orders.json
```

Or using Cloudflare Dashboard:
1. Go to Workers & Pages > KV
2. Select your KV namespace
3. Add key-value pairs manually by copying the JSON content

## Current Content

The `page_content.json` file contains:
- **Brand:** BIOCODE
- **Tagline:** "the science of life"
- **Navigation:** Anti-Aging, Невропептиди, Растеж, Лайфстайл, За нас
- **Product Categories:** 4 categories with multiple products each
- **Footer:** Links and copyright information

## Important Notes

- The `page_content.json` is the authoritative source for site content
- Any changes to site structure, products, or branding should be made in this file
- After updating KV, changes appear immediately on the site (no deployment needed)
