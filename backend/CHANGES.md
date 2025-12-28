# Backend Content Updates

## Summary
Updated all backend JSON files from BIOCODE (peptides) theme to OTSLABVAI (weight loss products) theme.

## Files Changed

### 1. site_content.json
- **Site name**: BIOCODE → ОТСЛАБВАНЕ
- **Slogan**: "the science of life" → "Здравословен начин на живот"
- **Navigation**: Changed from peptide categories to weight loss categories
  - Anti-Aging → Изгаряне на мазнини
  - Невропептиди → Апетит контрол
  - Растеж → Метаболизъм
  - Лайфстайл → Детокс
- **Page content**: Updated hero banner and info cards to reference weight loss instead of peptides
- **Footer**: Updated copyright from "© 2025 BIOCODE" → "© 2025 ОТСЛАБВАНЕ"

### 2. products.json
Completely replaced peptide products with weight loss products organized in 4 categories:

#### Category 1: Изгаряне на мазнини (Fat Burners)
- Екстракт от зелен чай (Green Tea Extract) - 45 BGN
- L-Carnitine - 55 BGN
- CLA (Конюгирана линолова киселина) - 60 BGN

#### Category 2: Контрол на апетита (Appetite Control)
- Глюкоманан (Glucomannan) - 40 BGN
- 5-HTP - 50 BGN
- Хром пиколинат (Chromium Picolinate) - 35 BGN

#### Category 3: Ускоряване на метаболизма (Metabolism)
- Кофеин (Caffeine) - 30 BGN
- Витамин B комплекс (B-Complex) - 38 BGN
- Капсаицин (Capsaicin) - 42 BGN

#### Category 4: Детокс и пречистване (Detox & Cleansing)
- Хлорела (Chlorella) - 48 BGN
- Бял трън (Milk Thistle) - 44 BGN
- Пробиотици (Probiotics) - 52 BGN

### 3. page_content.json
- Merged site_content.json with product categories from products.json
- Maintains the same JSON structure for frontend compatibility
- All content now references weight loss products instead of peptides

#### Category 5: Продукти за отслабване (Weight Loss Products)
- MeiziMax - 75 BGN
- Lida Green - 68 BGN
- Eveslim Cayenne Pepper - 62 BGN
- Eveslim Birch Bark - 62 BGN

## Product Details
Each product includes:
- Bulgarian name and tagline
- Price in BGN (Bulgarian Lev)
- Detailed description in Bulgarian
- Effects with percentage values
- Product variants
- System data (application type, goals, target profile, etc.)
- Safety warnings and protocol hints
- Inventory tracking

## Notes
- All JSON structures maintained for compatibility with existing frontend code
- Product IDs follow the pattern: prod-{product-name}
- Category IDs: fat-burners, appetite-control, metabolism, detox, weight-loss-products
- All text is in Bulgarian language
- Prices are set (not 0 like in the old peptide products)

## Update History
- **2025-12-28**: Added 3 new products to weight loss category (Lida Green, Eveslim Cayenne Pepper, Eveslim Birch Bark)
