# Backend Data Files

This directory contains JSON data files that are uploaded to Cloudflare KV storage.

## Files

### products.json
Contains all product data organized by categories. This is the **single source of truth** for products.

**Structure:**
```json
[
  {
    "type": "product_category",
    "component_id": "cat_weight_loss_products",
    "id": "weight-loss-products",
    "title": "Category Title",
    "image": "category-image-url",
    "options": {
      "is_collapsible": true,
      "is_expanded_by_default": true
    },
    "products": [
      {
        "product_id": "prod-lida-green",
        "public_data": { ... },
        "system_data": { ... }
      }
    ]
  }
]
```

**Upload to KV:**
```bash
npm run upload-backend
# or manually:
wrangler kv:key put --binding=PAGE_CONTENT products --path=backend/products.json
```

**Accessed via:**
- Frontend: `GET /products`
- Worker: `env.PAGE_CONTENT.get('products')`

### page_content.json
Contains site settings, navigation, page components (excluding product data), and footer configuration.

**Structure:**
```json
{
  "settings": { ... },
  "navigation": [ ... ],
  "page_content": [
    {
      "type": "hero_banner",
      ...
    },
    {
      "type": "product_category",
      "id": "weight-loss-products",
      "products": []  // Empty - products loaded from products.json
    }
  ],
  "footer": { ... }
}
```

**Upload to KV:**
```bash
npm run upload-backend
# or manually:
wrangler kv:key put --binding=PAGE_CONTENT page_content --path=backend/page_content.json
```

**Accessed via:**
- Frontend: `GET /page_content.json`
- Worker: `env.PAGE_CONTENT.get('page_content')`

## Important Notes

1. **Products are stored separately** from page_content to keep the structure clean and manageable.
2. Product categories in `page_content.json` have empty `products` arrays - actual products come from `products.json`.
3. The frontend automatically merges products from `/products` endpoint with categories from `/page_content.json`.
4. The admin panel handles products separately and saves them to the `/products` endpoint.

## Workflow

1. **Edit products**: Modify `backend/products.json`
2. **Edit site settings/layout**: Modify `backend/page_content.json`
3. **Upload**: Run `npm run upload-backend`
4. **Deploy**: Run `npm run deploy` (if worker.js changed)
5. **Test**: Refresh browser
