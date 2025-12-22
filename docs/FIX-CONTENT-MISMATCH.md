# Fix: Content Mismatch Issue (BIOCODE vs ОТСЛАБВАНЕ)

## Problem Description

When visiting the site, users briefly see content with the header "ОТСЛАБВАНЕ" (weight loss products), but then the page immediately changes to show "BIOCODE" (peptides) content with different navigation items. This creates a jarring user experience.

## Root Cause

The issue occurs because:

1. **Static HTML** (`index.html`) contains hardcoded content for "ОТСЛАБВАНЕ" site:
   - Brand name: "ОТСЛАБВАНЕ"
   - Design theme: Weight loss products
   - Color scheme and styling for weight loss niche

2. **Dynamic Content** from Cloudflare KV contains "BIOCODE" content:
   - The API endpoint `/page_content.json` serves data from KV storage
   - KV currently has "BIOCODE" (peptides) content stored
   - JavaScript loads this content and replaces the static HTML

3. **Content Loading Sequence**:
   ```
   Page Load → Show static "ОТСЛАБВАНЕ" → Fetch API → Replace with "BIOCODE" → Flash/Jump
   ```

## Solution

Update the Cloudflare KV storage to serve the correct "ОТСЛАБВАНЕ" content that matches the HTML design.

### Option 1: Using Wrangler CLI (Recommended)

This is the fastest and most reliable method:

```bash
# 1. Install wrangler if not already installed
npm install -g wrangler

# 2. Authenticate with Cloudflare
wrangler login

# 3. Run the update script
./scripts/update-kv-with-wrangler.sh
```

The script will:
- Read content from `page_content_mock.json`
- Upload it to the `PAGE_CONTENT` KV namespace
- Confirm the update

### Option 2: Using Admin Panel

If you have access to the admin panel:

1. Open `https://your-domain.com/admin.html`
2. Navigate to the "Content Management" section
3. Click "Load from Mock Data" or paste the content from `page_content_mock.json`
4. Click "Save"

### Option 3: Using API Script

If the API is accessible from your network:

```bash
# Run the Node.js script
node scripts/update-kv-content.js
```

### Option 4: Manual Update via Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages** → **KV**
3. Select the `PAGE_CONTENT` namespace
4. Find or create the key `page_content`
5. Paste the entire content from `page_content_mock.json`
6. Click **Save**

## Verification

After updating, verify the fix:

1. Clear your browser cache (Ctrl+Shift+Delete)
2. Visit your site
3. The page should now consistently show "ОТСЛАБВАНЕ" branding
4. No content flash or sudden change should occur

## Expected Content

After the fix, the site should display:

- **Site Name**: ОТСЛАБВАНЕ
- **Site Slogan**: Ефективни решения за здравословен живот
- **Navigation**: За нас, Как работи, Продукти, Отзиви, Въпроси, Контакти
- **Theme**: Weight loss products with relevant imagery and content

## Technical Details

### File Structure
```
index.html           ← Static content (ОТСЛАБВАНЕ theme)
page_content_mock.json  ← Correct content to upload
worker.js            ← Serves content from KV
```

### KV Key
- **Namespace**: `PAGE_CONTENT` (ID: `d220db696e414b7cb3da2b19abd53d0f`)
- **Key**: `page_content`
- **Value**: JSON object with settings, navigation, and page_content

### Data Flow
```
Browser Request
    ↓
index.html (static ОТСЛАБВАНЕ content)
    ↓
index.js loads
    ↓
Fetches /page_content.json
    ↓
Worker serves from KV['page_content']
    ↓
JavaScript replaces DOM with KV content
```

## Prevention

To prevent this issue in the future:

1. **Keep content in sync**: When updating HTML design, also update KV content
2. **Use version control**: Add content version numbers to track changes
3. **Test before deploy**: Always verify content matches after deployment
4. **Add content validation**: The worker could validate content format on upload

## Additional Notes

### Why Two Different Sites?

The repository shows signs of being repurposed:
- **Original**: BIOCODE (peptides e-commerce)
- **Current**: ОТСЛАБВАНЕ (weight loss products)

The HTML files were updated for the new site, but the KV storage was not updated accordingly.

### Mock Data Usage

The `page_content_mock.json` file contains the correct "ОТСЛАБВАНЕ" content and should be treated as the source of truth for the current site design.

### Content Customization

If you need to customize the content further:
1. Edit `page_content_mock.json`
2. Run the update script again
3. Or use the admin panel to make live changes
