#!/usr/bin/env python3
"""
Unified Effect Categories System

This script creates a comprehensive mapping of product effects to unified categories,
groups similar/synonymous effects together, and displays only the top 3 most prominent
effects for each product.

Effect Categories:
- Appetite Control (Контрол на апетита)
- Weight Loss (Отслабване)
- Thermogenesis (Термогенеза)
- Energy (Енергия)
- Metabolism (Метаболизъм)
- Detox (Детоксикация)
- Fat Burning (Изгаряне на мазнини)
- Anti-Cellulite (Анти-целулит)
- Diuretic (Отводняване)
- Skin Quality (Качество на кожата)
"""

import json
from fix_products_json import load_products_json

# Unified effect categories with their synonyms/related effects
UNIFIED_EFFECTS = {
    "Контрол на апетита": {
        "label": "Контрол на апетита",
        "synonyms": [
            "Спиране на глада",
            "Намаляване на апетита",
            "Контрол на апетита",
            "Потискане на апетита"
        ],
        "description": "Намаляване на глада и апетита"
    },
    "Отслабване": {
        "label": "Отслабване",
        "synonyms": [
            "Сваляне на килограми",
            "Отслабване",
            "Бързина на ефекта"
        ],
        "description": "Намаляване на телесното тегло"
    },
    "Термогенеза": {
        "label": "Термогенеза",
        "synonyms": [
            "Термогенеза",
            "Термогенеза (загряване)",
            "Събуждане на метаболизма"
        ],
        "description": "Повишаване на телесната температура и изгаряне на калории"
    },
    "Енергия": {
        "label": "Енергия",
        "synonyms": [
            "Енергия",
            "Енергия и тонус",
            "Фокус"
        ],
        "description": "Повишаване на енергията и фокуса"
    },
    "Метаболизъм": {
        "label": "Метаболизъм",
        "synonyms": [
            "Метаболизъм",
            "Изгаряне на мазнини"
        ],
        "description": "Ускоряване на обмяната на веществата"
    },
    "Детоксикация": {
        "label": "Детоксикация",
        "synonyms": [
            "Детокс",
            "Чиста кожа и детокс"
        ],
        "description": "Прочистване на организма от токсини"
    },
    "Анти-целулит": {
        "label": "Анти-целулит",
        "synonyms": [
            "Премахване на целулит",
            "Премахване на целулита"
        ],
        "description": "Намаляване на целулита"
    },
    "Отводняване": {
        "label": "Отводняване",
        "synonyms": [
            "Спадане на отоци",
            "Отводняване"
        ],
        "description": "Премахване на задържаната вода"
    }
}

def map_effect_to_unified(effect_label):
    """
    Map a specific effect label to its unified category.
    Returns tuple: (unified_label, original_label)
    """
    effect_label_lower = effect_label.lower()
    
    for unified_key, unified_data in UNIFIED_EFFECTS.items():
        for synonym in unified_data['synonyms']:
            if synonym.lower() == effect_label_lower or synonym.lower() in effect_label_lower:
                return (unified_data['label'], effect_label)
    
    # If no match found, return as is
    return (effect_label, effect_label)

def analyze_product_effects(product, is_bestseller=False):
    """
    Analyze a product and return all possible effects with their values,
    grouped by unified categories.
    """
    pub_data = product.get('public_data', {})
    sys_data = product.get('system_data', {})
    current_effects = pub_data.get('effects', [])
    
    # Dictionary to store unified effects with their max values
    unified_effects_map = {}
    
    # Map current effects to unified categories
    for effect in current_effects:
        label = effect.get('label', '')
        value = effect.get('value', 0)
        
        unified_label, original_label = map_effect_to_unified(label)
        
        # Keep the highest value for each unified category
        if unified_label not in unified_effects_map:
            unified_effects_map[unified_label] = {
                'value': value,
                'sources': [original_label]
            }
        else:
            # Keep max value and track all sources
            unified_effects_map[unified_label]['value'] = max(
                unified_effects_map[unified_label]['value'],
                value
            )
            if original_label not in unified_effects_map[unified_label]['sources']:
                unified_effects_map[unified_label]['sources'].append(original_label)
    
    # Infer additional effects based on product characteristics
    name = pub_data.get('name', '').lower()
    goals = sys_data.get('goals', [])
    ingredients = pub_data.get('ingredients', [])
    
    # Infer effects from product name and goals
    if not is_bestseller:
        # Weight loss products
        if 'weight-loss' in goals or 'отслабване' in name:
            if 'Отслабване' not in unified_effects_map:
                unified_effects_map['Отслабване'] = {'value': 80, 'sources': ['inferred']}
        
        # Thermogenic products
        if 'thermo' in name or 'burn' in name or 'термо' in name:
            if 'Термогенеза' not in unified_effects_map:
                unified_effects_map['Термогенеза'] = {'value': 85, 'sources': ['inferred']}
        
        # Energy products
        if 'energy' in goals or 'енергия' in name:
            if 'Енергия' not in unified_effects_map:
                unified_effects_map['Енергия'] = {'value': 80, 'sources': ['inferred']}
        
        # Fat burning
        if 'fat' in name or 'lipo' in name:
            if 'Метаболизъм' not in unified_effects_map:
                unified_effects_map['Метаболизъм'] = {'value': 85, 'sources': ['inferred']}
    
    return unified_effects_map

def get_top_3_effects(unified_effects_map):
    """
    Get the top 3 most prominent effects from the unified effects map.
    Returns list of effect dictionaries.
    """
    # Sort by value descending
    sorted_effects = sorted(
        unified_effects_map.items(),
        key=lambda x: x[1]['value'],
        reverse=True
    )
    
    # Take top 3
    top_3 = sorted_effects[:3]
    
    # Convert to standard effect format
    result = []
    for label, data in top_3:
        result.append({
            'label': label,
            'value': data['value']
        })
    
    return result

def update_products_with_unified_effects():
    """
    Update all products with unified effect categories,
    showing only the top 3 most prominent effects.
    """
    print("=" * 80)
    print("UPDATING PRODUCTS WITH UNIFIED EFFECT CATEGORIES")
    print("=" * 80)
    
    data = load_products_json('backend/products.json')
    
    stats = {
        'products_updated': 0,
        'effects_unified': 0,
        'categories_used': set()
    }
    
    for cat in data['categories']:
        if cat.get('type') != 'product_category':
            continue
        
        cat_title = cat.get('title', '')
        is_bestseller_cat = 'БЕСТСЕЛЪР' in cat_title
        
        print(f"\n{cat_title}:")
        print("-" * 80)
        
        for product in cat.get('products', []):
            pub_data = product.get('public_data', {})
            name = pub_data.get('name', '')
            
            # Analyze and get unified effects
            unified_effects_map = analyze_product_effects(product, is_bestseller_cat)
            
            # Get top 3
            top_3_effects = get_top_3_effects(unified_effects_map)
            
            # Update product
            pub_data['effects'] = top_3_effects
            
            stats['products_updated'] += 1
            stats['effects_unified'] += len(unified_effects_map)
            
            print(f"\n{name}:")
            print(f"  Unified effects found: {len(unified_effects_map)}")
            for eff_label, eff_data in sorted(
                unified_effects_map.items(),
                key=lambda x: x[1]['value'],
                reverse=True
            ):
                sources = ', '.join(eff_data['sources'][:2])  # Show first 2 sources
                print(f"    • {eff_label}: {eff_data['value']} (from: {sources})")
            
            print(f"  Top 3 selected:")
            for eff in top_3_effects:
                print(f"    ✓ {eff['label']}: {eff['value']}")
                stats['categories_used'].add(eff['label'])
    
    # Save updated products
    categories = data.get('categories', [])
    footer = data.get('footer', {})
    
    lines = []
    
    for i, cat in enumerate(categories):
        cat_json = json.dumps(cat, ensure_ascii=False, indent=2)
        cat_lines = cat_json.split('\n')
        for line in cat_lines:
            lines.append('    ' + line)
        
        if i < len(categories) - 1:
            lines[-1] = lines[-1] + ','
    
    lines.append('  ],')
    footer_json = json.dumps(footer, ensure_ascii=False, indent=2)
    footer_lines = footer_json.split('\n')
    for i, line in enumerate(footer_lines):
        if i == 0:
            lines.append('  "footer": ' + line)
        else:
            lines.append('  ' + line)
    
    with open('backend/products.json', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print("\n" + "=" * 80)
    print("UPDATE SUMMARY")
    print("=" * 80)
    print(f"Products updated: {stats['products_updated']}")
    print(f"Total effect mappings: {stats['effects_unified']}")
    print(f"Unified categories used: {len(stats['categories_used'])}")
    print(f"Categories: {', '.join(sorted(stats['categories_used']))}")
    
    return stats

if __name__ == '__main__':
    stats = update_products_with_unified_effects()
    
    print("\n" + "=" * 80)
    print("UNIFIED EFFECT CATEGORIES REFERENCE")
    print("=" * 80)
    
    for unified_key, unified_data in UNIFIED_EFFECTS.items():
        print(f"\n{unified_data['label']}:")
        print(f"  Description: {unified_data['description']}")
        print(f"  Synonyms: {', '.join(unified_data['synonyms'])}")
