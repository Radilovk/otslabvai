# Promo Codes Data

This file contains the initial promo codes data for the system.

## Structure

Each promo code has the following fields:
- `id`: Unique identifier (auto-generated)
- `code`: The promo code string (case-insensitive)
- `discount`: Discount amount (percentage or fixed)
- `discountType`: Either "percentage" or "fixed"
- `description`: Human-readable description
- `validFrom`: Start date of validity (ISO 8601)
- `validUntil`: End date of validity (ISO 8601) or null for no expiry
- `maxUses`: Maximum number of times this code can be used, or null for unlimited
- `usedCount`: Current number of times the code has been used
- `active`: Boolean indicating if the code is currently active
- `createdAt`: Timestamp when the code was created

## Upload to KV Storage

To upload this data to Cloudflare KV:

```bash
# Using wrangler CLI
wrangler kv:key put --binding=PAGE_CONTENT "promo_codes" --path=backend/promo-codes.json

# Or use the admin panel to create promo codes via the UI
```

## API Endpoints

- `GET /promo-codes` - Get all promo codes
- `POST /promo-codes` - Create a new promo code
- `PUT /promo-codes` - Update an existing promo code
- `DELETE /promo-codes?id=<id>` - Delete a promo code
- `POST /validate-promo` - Validate a promo code for checkout

## Notes

- Promo codes are case-insensitive
- Validation checks: active status, validity dates, usage limits
- Usage count is automatically incremented when a code is successfully used in an order
