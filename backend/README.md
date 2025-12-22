# Backend Files for Cloudflare KV Upload

This folder contains the JSON files that should be uploaded to Cloudflare Workers KV storage.

## KV Namespace Binding

The worker uses a KV namespace binding called `PAGE_CONTENT`.

## Files to Upload

Upload each JSON file to the KV store with the following keys:

1. **page_content.json** → KV key: `page_content` (REQUIRED)
   - Contains the complete site structure: settings, navigation, page_content array, and footer
   - This is the main content file that controls the entire site appearance
   - Includes all product categories and their products

2. **orders.json** → KV key: `orders` (REQUIRED)
   - Contains order records
   - Updated when customers place orders through the questionnaire
   - Initialize with empty array `[]` if no orders exist

3. **products.json** → (Optional, currently not used by worker)
   - Alternative product structure
   - Kept for reference

4. **site_content.json** → (Optional, currently not used by worker)
   - Simplified content without products
   - Kept for reference

## Additional KV Keys Required

The worker also requires these KV keys (not in this folder):

- **`bot_prompt`** → AI prompt template for product recommendations
  - Used by the questionnaire feature to generate personalized product suggestions
  - Contact admin for the prompt template

- **`clients`** → Client data from questionnaires (auto-generated)
  - Initialize with empty array `[]` if not exists
  
- **`results`** → AI recommendation results (auto-generated)
  - Initialize with empty array `[]` if not exists

## Upload Instructions

### Using Wrangler CLI (Recommended)

```bash
# Make sure you're in the project root directory
cd /path/to/otslabvai

# Upload page_content (main content file - REQUIRED)
wrangler kv:key put --binding=PAGE_CONTENT "page_content" --path=backend/page_content.json

# Upload orders (initialize if not exists - REQUIRED)
wrangler kv:key put --binding=PAGE_CONTENT "orders" --path=backend/orders.json

# Initialize clients array if not exists (auto-managed by worker)
echo "[]" | wrangler kv:key put --binding=PAGE_CONTENT "clients"

# Initialize results array if not exists (auto-managed by worker)
echo "[]" | wrangler kv:key put --binding=PAGE_CONTENT "results"

# Upload bot_prompt (contact admin for the template)
# wrangler kv:key put --binding=PAGE_CONTENT "bot_prompt" --path=path/to/bot_prompt.txt
```

### Using Cloudflare Dashboard

1. Go to Workers & Pages > KV
2. Select your KV namespace (PAGE_CONTENT)
3. Add key-value pairs manually:
   - Click "Add entry"
   - Enter the key name (e.g., "page_content")
   - Paste the JSON content from the file
   - Click "Add"

### Verification

After uploading, verify the content is correct:

```bash
# Check page_content
wrangler kv:key get --binding=PAGE_CONTENT "page_content" | jq '.settings.site_name'
# Should output: "BIOCODE"

# Check orders
wrangler kv:key get --binding=PAGE_CONTENT "orders" | jq '. | length'
# Should output: number of orders
```

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
