# Fix for Overlapping KV Records Issue

## Problem Summary
The application was not displaying products from `backend/products.json` because:
- The application loads `page_content.json` from Cloudflare KV
- `products.json` contained different products than `page_content.json`
- There was confusion about which file to edit (overlapping information)

## Solution Implemented

### 1. Data Merge
**Merged products from `products.json` into `page_content.json`:**
- Fat-burners category updated from 3 generic products to 5 premium products:
  - RAW Nutrition Essential Fat Burner (99 лв)
  - Trec Nutrition Thermo Fat Burner Max (42 лв)
  - AllNutrition Burn4All Fat Reductor (25 лв)
  - EthicSport Thermo Master (64 лв)
  - Sport Definition Fat No More (49 лв)

**Total products now: 18 across 5 categories**

### 2. Documentation
Created `backend/STRUCTURE_EXPLANATION.md` explaining:
- Purpose of each JSON file
- Which file the application uses (page_content.json)
- How to update content properly
- How to prevent data drift

### 3. Validation Tool
Created `backend/validate.mjs` to:
- Validate JSON syntax
- Check required fields
- Count products
- Detect duplicates
- Run with: `npm run validate-backend`

### 4. Updated Files
- ✅ `backend/page_content.json` - Merged with products from products.json
- ✅ `page_content_mock.json` - Updated with same data for local fallback
- ✅ `backend/STRUCTURE_EXPLANATION.md` - New documentation
- ✅ `backend/validate.mjs` - New validation script
- ✅ `package.json` - Added validation script

## Deployment Instructions

### To Deploy the Fixed Content to Production:

**Option 1: Using Wrangler CLI (Recommended)**

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Upload the updated page_content.json to Cloudflare KV
wrangler kv:key put --binding=PAGE_CONTENT page_content --path=page_content.json

# 3. Verify the upload
wrangler kv:key get --binding=PAGE_CONTENT page_content
```

**Option 2: Using Cloudflare Dashboard**

1. Go to Cloudflare Dashboard
2. Navigate to: **Workers & Pages** → **KV** → **PAGE_CONTENT**
3. Find the key named: `page_content`
4. Click **Edit** and paste the entire content of `backend/page_content.json`
5. Click **Save**

**Option 3: Using Cloudflare API**

```bash
# Set your credentials
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
export KV_NAMESPACE_ID="d220db696e414b7cb3da2b19abd53d0f"

# Upload the file
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/page_content" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @backend/page_content.json
```

### To Update Static Files (if needed):

```bash
# Upload all static files (HTML, JS, CSS)
npm run upload-static

# Then deploy the worker
npm run deploy
```

## Verification Steps

After deployment:

1. **Clear browser cache** or open in incognito mode
2. **Visit the website**: https://port.radilov-k.workers.dev/
3. **Check the fat-burners section** - should show 5 products:
   - RAW Nutrition Essential Fat Burner - 99 лв
   - Trec Nutrition Thermo Fat Burner Max - 42 лв
   - AllNutrition Burn4All Fat Reductor - 25 лв
   - EthicSport Thermo Master - 64 лв
   - Sport Definition Fat No More - 49 лв
4. **Check weight-loss-products section** - should show 4 products:
   - MeiziMax - 75 лв
   - Lida Green - 68 лв
   - Eveslim Cayenne Pepper - 62 лв
   - Eveslim Birch Bark - 62 лв
5. **Total product count**: 18 products across 5 categories

## Troubleshooting

**Problem**: Products still not showing after deployment
- **Solution**: Clear browser cache (Ctrl+Shift+Delete) or test in incognito mode
- **Verify**: Check that the KV key `page_content` was updated in Cloudflare Dashboard

**Problem**: JSON validation errors
- **Solution**: Run `npm run validate-backend` before uploading
- **Check**: Ensure JSON syntax is valid with `jq empty backend/page_content.json`

**Problem**: Need to add more products
- **Solution**: Edit `backend/page_content.json`, validate, then upload to KV
- **Reference**: See `backend/STRUCTURE_EXPLANATION.md` for detailed instructions

## Important Notes

1. **Always edit `backend/page_content.json` for production changes**
2. **Run validation before uploading**: `npm run validate-backend`
3. **After editing, upload to KV** - changes don't take effect automatically
4. **The mock file** (`page_content_mock.json`) is only used for local fallback
5. **For reference only**: `backend/products.json` and `backend/site_content.json` are not used by the application

## Related Files

- `backend/page_content.json` - **PRIMARY FILE** - Used by application
- `backend/products.json` - Reference only (product source)
- `backend/site_content.json` - Reference only (site structure)
- `page_content_mock.json` - Local fallback (must match page_content.json)
- `backend/STRUCTURE_EXPLANATION.md` - Detailed documentation
- `backend/validate.mjs` - Validation script

## Questions?

Refer to:
- `backend/STRUCTURE_EXPLANATION.md` - For file structure and update procedures
- `BACKEND_UPDATE_SUMMARY.md` - For product listing and change history
- `HOW_TO_FIX.md` - For worker and static file deployment
