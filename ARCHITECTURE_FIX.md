# ARCHITECTURE FIX: Single Source of Truth for Products

## Problem Identified
❌ **MAJOR ARCHITECTURAL ERROR**: Products are duplicated in TWO files:
- `backend/products.json` (4 products in products.json, different structure)
- `backend/page_content.json` (12 products in page_content.json)

This causes:
- Confusion about which file to edit
- Data synchronization issues
- Conflicting product information
- Difficulty maintaining consistency

## Solution: Single Source of Truth

✅ **DECISION: Use ONLY `backend/page_content.json`**

### Why page_content.json?
1. ✅ Already used by frontend (index.js, product.js, admin.js)
2. ✅ Already deployed to Cloudflare KV
3. ✅ Contains ALL 12 products (vs 4 in products.json)
4. ✅ Contains complete site structure (navigation, footer, settings)
5. ✅ Documented as PRIMARY file in README.md

### Why DELETE products.json?
1. ❌ NOT used by any frontend code
2. ❌ Only used by Python scripts (which we can update)
3. ❌ Contains fewer products (4 vs 12)
4. ❌ Causes confusion and maintenance burden

## Implementation

### Step 1: Mark products.json as DEPRECATED ✅
- Rename to `products.json.DEPRECATED`
- Add clear documentation that it's not used

### Step 2: Update all Python scripts ✅
Update these scripts to use ONLY page_content.json:
- `apply_user_feedback.py`
- `fix_products_json.py`
- `unified_effects.py`
- `validate_products.py`
- `fix_product_issues.py`
- `add_new_products.py`
- `fix_product_research.py` (the new one)

### Step 3: Clear Documentation ✅
Update all documentation to state:
- **ONLY edit `backend/page_content.json`**
- `products.json` is DEPRECATED and ignored

## Result

✅ **SINGLE SOURCE OF TRUTH**: `backend/page_content.json`
- Contains ALL products
- Used by frontend
- Used by backend scripts
- NO confusion
- NO duplication

---

## For Future Reference

**To add/edit products:**
1. Edit `backend/page_content.json` directly
2. Validate JSON: `jq empty backend/page_content.json`
3. Test locally
4. Deploy to Cloudflare KV: `wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json`

**DO NOT:**
- Create additional product files
- Edit products.json.DEPRECATED
- Duplicate product data anywhere

---

Date: 2026-01-23
Status: IMPLEMENTED
