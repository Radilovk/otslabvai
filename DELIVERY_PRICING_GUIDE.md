# Delivery Pricing Implementation Guide

## Currency Change: BGN → EUR

All prices on the website have been converted from Bulgarian Lev (BGN) to Euro (EUR) using the exchange rate: **1 EUR = 1.95583 BGN**

### Product Prices (Converted)
- Lida Green: 68 BGN → **34.77 €**
- MeiziMax: 75 BGN → **38.35 €**
- Eveslim Birch Bark: 62 BGN → **31.70 €**
- Eveslim Cayenne Pepper: 62 BGN → **31.70 €**
- Essential: 99 BGN → **50.61 €**
- Fat No More: 49 BGN → **25.05 €**
- Thermo Fat Burner: 42 BGN → **21.47 €**
- Burn4All: 25 BGN → **12.78 €**
- Thermo Master: 64 BGN → **32.72 €**

## Dynamic Delivery Pricing

### Formula
The delivery cost is calculated using the formula from `formula.txt`:

```
deliveryCost = basePrice + (totalProductAmount × codRate)
```

Where:
- `basePrice` = base delivery cost for the selected courier and delivery method
- `totalProductAmount` = subtotal of all products in the cart
- `codRate` = Cash on Delivery fee as a percentage

### Pricing Structure

#### Speedy
- **Office/Automat delivery**: 1.52 € base + 0.96% COD fee
- **Door delivery**: 5.62 € base + 0.96% COD fee

#### Econt
- **Office/Econtomat delivery**: 3.10 € base + 2.98% COD fee
- **Door delivery**: 4.55 € base + 2.98% COD fee

### Free Shipping
Orders **over 100 €** receive **FREE shipping** regardless of delivery method.

### Examples

1. **20 € order to Speedy Automat:**
   - Calculation: 1.52 + (20 × 0.0096) = 1.52 + 0.19 = **1.71 €**

2. **50 € order to Econt Office:**
   - Calculation: 3.10 + (50 × 0.0298) = 3.10 + 1.49 = **4.59 €**

3. **30 € order to personal address (default Econt door):**
   - Calculation: 4.55 + (30 × 0.0298) = 4.55 + 0.89 = **5.44 €**

4. **150 € order (any method):**
   - Result: **FREE** (orders over 100 €)

## Implementation Details

### Location: `checkout.html`

The `calculateShipping()` function dynamically calculates delivery cost based on:
1. Cart subtotal
2. Selected delivery method (address vs courier office)
3. Selected courier company (Speedy or Econt)

### Real-time Updates

The shipping price updates automatically when the user:
- Changes delivery method (address ↔ courier office)
- Selects a different courier (Speedy ↔ Econt)
- Adds/removes products from cart
- Changes product quantities

### Display

- During checkout: Shows calculated price (e.g., "4.59 €") or "Безплатна" (Free) for orders over 100 €
- In order summary: Included in the final order data sent to the backend

## Files Modified

1. **checkout.html** - Dynamic shipping calculation and currency display
2. **shipping.html** - Updated delivery information
3. **index.html** - Promotional banners and free shipping threshold
4. **product.js** - Product detail price display
5. **index.js** - Product card prices and promo text
6. **questionnaire.js** - Variant prices
7. **admin.html** - Admin panel placeholders
8. **backend/page_content.json** - Product prices and promo text
9. **backend/products.json** - Reference product prices
10. **formula.txt** - Delivery pricing formulas (new file)

## Testing Checklist

- [ ] Verify all product prices display in EUR
- [ ] Test delivery price calculation for each courier option
- [ ] Verify free shipping for orders over 100 €
- [ ] Test real-time updates when changing delivery methods
- [ ] Check order submission includes correct delivery price
- [ ] Verify promotional banners show 100 € instead of 100 BGN
