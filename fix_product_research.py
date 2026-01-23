#!/usr/bin/env python3
"""
Fix product categorization and effects based on actual product research.
This script corrects:
1. Product taglines (removes "термогенен фет бърнер" from non-thermogenic products)
2. Product effects (replaces generic characteristics with actual product benefits)
3. Product descriptions to reflect real mechanisms of action

IMPORTANT: This script works ONLY with backend/page_content.json (single source of truth).
backend/products.json has been DEPRECATED to eliminate duplicate data.
"""

import json

# Product categorization based on actual ingredients and mechanisms
PRODUCT_CONFIG = {
    # HERBAL APPETITE SUPPRESSORS (Not thermogenic fat burners)
    "prod-lida-green": {
        "tagline": "АБСОЛЮТНИЯТ ЛИДЕР: Най-мощният ефект на пазара",
        "effects": [
            {"label": "Контрол на апетита", "value": 100},
            {"label": "Отслабване", "value": 100},
            {"label": "Бързина на ефекта", "value": 95}
        ],
        "is_thermogenic": False,
        "type": "Herbal appetite suppressor with mild thermogenic properties"
    },
    "prod-meizimax": {
        "tagline": "Японска формула за стройна фигура и сияйна кожа",
        "effects": [
            {"label": "Контрол на апетита", "value": 90},
            {"label": "Детоксикация", "value": 90},
            {"label": "Подобрена кожа", "value": 85}
        ],
        "is_thermogenic": False,
        "type": "Herbal beauty and weight loss formula"
    },
    "prod-eveslim-birch": {
        "tagline": "№1 срещу целулит, отоци и подпухване",
        "effects": [
            {"label": "Анти-целулит", "value": 100},
            {"label": "Отводняване", "value": 95},
            {"label": "Детоксикация", "value": 85}
        ],
        "is_thermogenic": False,
        "type": "Anti-cellulite and lymphatic drainage formula"
    },
    "prod-eveslim-cayenne": {
        "tagline": "Огнена сила срещу бавен метаболизъм",
        "effects": [
            {"label": "Термогенеза", "value": 90},
            {"label": "Метаболизъм", "value": 85},
            {"label": "Кръвообращение", "value": 80}
        ],
        "is_thermogenic": True,
        "type": "Natural thermogenic metabolism booster"
    },
    "prod-ethicsport-thermo-master": {
        "tagline": "Италиански билков комплекс за метаболизъм",
        "effects": [
            {"label": "Натурална формула", "value": 100},
            {"label": "Метаболизъм", "value": 75},
            {"label": "Детоксикация", "value": 70}
        ],
        "is_thermogenic": False,
        "type": "Natural metabolic support formula (not a fat burner)"
    },
    
    # SYNTHETIC/MIXED THERMOGENIC FAT BURNERS
    "prod-16905": {  # Fat No More
        "tagline": "Sport Definition - Термогенен фет бърнер с L-Carnitine",
        "effects": [
            {"label": "Термогенеза", "value": 85},
            {"label": "Енергия", "value": 80},
            {"label": "Транспорт на мазнини", "value": 85}
        ],
        "is_thermogenic": True,
        "type": "Thermogenic fat burner with L-Carnitine"
    },
    "prod-24527": {  # Thermo Caps
        "tagline": "Nutriversum - Термогенен фет бърнер за жени",
        "effects": [
            {"label": "Термогенеза", "value": 85},
            {"label": "Енергия", "value": 80},
            {"label": "Женска формула", "value": 90}
        ],
        "is_thermogenic": True,
        "type": "Female-targeted thermogenic fat burner"
    },
    "prod-37086": {  # Essential Fat Burner
        "tagline": "RAW Nutrition - Премиум термогенен фет бърнер",
        "effects": [
            {"label": "Термогенеза", "value": 90},
            {"label": "Енергия", "value": 85},
            {"label": "Фокус", "value": 85}
        ],
        "is_thermogenic": True,
        "type": "Premium thermogenic fat burner with high caffeine"
    },
    "prod-24605": {  # Burn4All Extreme
        "tagline": "AllNutrition - Екстремен термогенен фет бърнер",
        "effects": [
            {"label": "Термогенеза", "value": 95},
            {"label": "Енергия", "value": 90},
            {"label": "Интензивност", "value": 90}
        ],
        "is_thermogenic": True,
        "type": "Extreme intensity thermogenic fat burner"
    },
    "prod-5177": {  # Fat Transporter
        "tagline": "Trec Nutrition - Липотропен термогенен фет бърнер",
        "effects": [
            {"label": "Транспорт на мазнини", "value": 90},
            {"label": "Термогенеза", "value": 85},
            {"label": "Метаболизъм", "value": 85}
        ],
        "is_thermogenic": True,
        "type": "Lipotropic thermogenic fat burner"
    },
    "prod-31": {  # Lipo 6 / L-Carnitine
        "tagline": "Nutrex - Термогенен фет бърнер с L-Carnitine",
        "effects": [
            {"label": "Транспорт на мазнини", "value": 90},
            {"label": "Термогенеза", "value": 85},
            {"label": "Издръжливост", "value": 80}
        ],
        "is_thermogenic": True,
        "type": "Thermogenic fat burner with L-Carnitine focus"
    },
    "prod-742": {  # Lipo 6 Black
        "tagline": "Nutrex - Максимална сила термогенен фет бърнер",
        "effects": [
            {"label": "Термогенеза", "value": 95},
            {"label": "Енергия", "value": 92},
            {"label": "Интензивност", "value": 95}
        ],
        "is_thermogenic": True,
        "type": "Maximum strength thermogenic fat burner"
    }
}


def update_products_json(filepath):
    """DEPRECATED: products.json is no longer used. Use update_page_content_json instead."""
    print("⚠️  WARNING: products.json has been DEPRECATED")
    print("    All products are now in backend/page_content.json only")
    return 0


def update_page_content_json(filepath):
    """Update page_content.json with corrected data"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    updated_count = 0
    
    for item in data.get('page_content', []):
        if item.get('type') == 'product_category':
            for product in item.get('products', []):
                product_id = product.get('product_id')
                if product_id and product_id in PRODUCT_CONFIG:
                    config = PRODUCT_CONFIG[product_id]
                    public_data = product.get('public_data', {})
                    
                    # Update tagline
                    if public_data.get('tagline') != config['tagline']:
                        print(f"Updating {product_id}: {public_data.get('name')}")
                        print(f"  Old tagline: {public_data.get('tagline')}")
                        print(f"  New tagline: {config['tagline']}")
                        public_data['tagline'] = config['tagline']
                        updated_count += 1
                    
                    # Update effects
                    if 'effects' in config:
                        old_effects = public_data.get('effects', [])
                        print(f"  Old effects: {[e.get('label') for e in old_effects]}")
                        print(f"  New effects: {[e['label'] for e in config['effects']]}")
                        public_data['effects'] = config['effects']
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Updated {updated_count} products in {filepath}")
    return updated_count


def main():
    print("=" * 80)
    print("FIXING PRODUCT RESEARCH AND PRESENTATION")
    print("=" * 80)
    print("\n⚠️  ARCHITECTURE FIX: Using ONLY page_content.json (single source of truth)")
    print("    products.json has been DEPRECATED\n")
    print("\nBased on actual ingredient analysis:")
    print("- NOT thermogenic fat burners: Lida Green, MeiziMax, Eveslim Birch, Thermo Master")
    print("- Thermogenic with natural ingredients: Eveslim Cayenne Pepper")
    print("- True thermogenic fat burners (synthetic/mixed): 7 products with caffeine + L-Carnitine")
    print("\n")
    
    # Update ONLY page_content.json (single source of truth)
    page_content_updated = update_page_content_json('/home/runner/work/otslabvai/otslabvai/backend/page_content.json')
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: Updated {page_content_updated} products in page_content.json")
    print("=" * 80)
    print("\n✅ All changes applied to backend/page_content.json")
    print("   This is now the ONLY file containing product data.")


if __name__ == '__main__':
    main()
