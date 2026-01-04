# Backend JSON Structure Explanation

## Overview
This directory contains JSON files for the OTSLABVAI weight loss products website backend. Understanding the relationship between these files is crucial for maintaining the application.

## File Structure

### 1. `page_content.json` (PRIMARY FILE - USED BY APPLICATION)
**Purpose**: This is the MASTER file that the application loads. It contains ALL content including:
- Site settings (logo, name, slogan, theme)
- Navigation menu
- Page content components (hero banners, info cards)
- Product categories with full product details
- Footer configuration

**Used by**: 
- Frontend application (`index.js`, `product.js`, `admin.js`, `checkout.html`)
- Cloudflare Worker (`worker.js` - served via `/page_content.json` endpoint)

**Important**: Any changes you want to appear on the website MUST be made to this file.

### 2. `products.json` (REFERENCE/SOURCE FILE)
**Purpose**: Contains ONLY product catalog data - product categories and products with full details.

**Structure**:
```json
{
  "product_categories": [
    {
      "type": "product_category",
      "id": "fat-burners",
      "title": "Изгаряне на мазнини",
      "products": [ /* detailed product objects */ ]
    },
    // ... more categories
  ]
}
```

**Use case**: 
- Source of truth for product data
- Can be used to bulk update products
- Easier to edit products without navigating through full page content

**Note**: This file is NOT directly loaded by the application. Products must be merged into `page_content.json` to appear on the website.

### 3. `site_content.json` (REFERENCE/LEGACY FILE)
**Purpose**: Contains basic site configuration without products.

**Structure**:
```json
{
  "settings": { /* site settings */ },
  "navigation": [ /* nav items */ ],
  "page_content": [ /* non-product components only */ ],
  "footer": { /* footer config */ }
}
```

**Use case**: 
- Reference for site structure without products
- Legacy file from initial project setup
- Can be used as a template for new instances

**Note**: This file is NOT used by the application. Changes here will not appear on the website.

## Product Categories

The website has 5 product categories:

### 1. Изгаряне на мазнини (fat-burners)
5 products:
- RAW Nutrition Essential Fat Burner - 99 лв
- Trec Nutrition Thermo Fat Burner Max - 42 лв
- AllNutrition Burn4All Fat Reductor - 25 лв
- EthicSport Thermo Master - 64 лв
- Sport Definition Fat No More - 49 лв

### 2. Контрол на апетита (appetite-control)
3 products:
- Глюкоманан - 40 лв
- 5-HTP - 50 лв
- Хром пиколинат - 35 лв

### 3. Ускоряване на метаболизма (metabolism)
3 products:
- Кофеин - 30 лв
- Витамин B комплекс - 38 лв
- Капсаицин - 42 лв

### 4. Детокс и пречистване (detox)
3 products:
- Хлорела - 48 лв
- Бял трън (Milk Thistle) - 44 лв
- Пробиотици - 52 лв

### 5. Продукти за отслабване (weight-loss-products)
4 products:
- MeiziMax - 75 лв
- Lida Green - 68 лв
- Eveslim Cayenne Pepper - 62 лв
- Eveslim Birch Bark - 62 лв

## How to Update Content

### To Update Products:

**Option 1: Edit page_content.json directly**
1. Open `backend/page_content.json`
2. Find the product category you want to edit
3. Locate the product in the `products` array
4. Make your changes
5. Validate JSON syntax
6. Upload to Cloudflare KV (key: `page_content`)

**Option 2: Edit products.json and merge**
1. Edit `backend/products.json`
2. Run the merge script to update `page_content.json`:
   ```javascript
   // Create a merge script or manually copy products array
   ```
3. Upload updated `page_content.json` to Cloudflare KV

### To Update Site Settings:
1. Edit the `settings` object in `page_content.json`
2. Upload to Cloudflare KV

### To Update Navigation:
1. Edit the `navigation` array in `page_content.json`
2. Upload to Cloudflare KV

## Preventing Data Drift

**Important**: To avoid confusion and overlapping information:

1. **Always edit `page_content.json` for production changes**
2. If you edit `products.json`, remember to merge changes into `page_content.json`
3. `site_content.json` is for reference only - do not use it for production
4. After editing, always validate JSON:
   ```bash
   jq empty page_content.json
   ```
5. Test changes locally before uploading to KV

## Recent Changes

**2025-01-04**: Fixed overlapping KV records issue
- Merged products from `products.json` into `page_content.json`
- Fat-burners category now shows 5 premium products instead of 3 generic ones
- All products from `products.json` are now visible on the website

## Upload to Cloudflare KV

After making changes to `page_content.json`, upload it to Cloudflare KV:

```bash
# Using wrangler CLI
wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json

# Or using Cloudflare Dashboard
# Navigate to: Workers & Pages > KV > PAGE_CONTENT
# Edit key: page_content
# Paste the content of page_content.json
```

## Troubleshooting

**Problem**: Products not showing on website
- **Solution**: Check if products are in `page_content.json`, not just `products.json`

**Problem**: Changes not appearing after upload
- **Solution**: Clear browser cache or add cache-busting query parameter

**Problem**: JSON syntax errors
- **Solution**: Validate with `jq empty filename.json` before uploading

## Contact
For questions about the backend structure, consult this document or check `BACKEND_UPDATE_SUMMARY.md`.
