#!/usr/bin/env python3
"""
Update products based on user feedback:
1. Convert prices from BGN to EUR
2. Standardize effect bars to top 3 criteria for non-bestseller products
3. Optimize and improve code quality
"""

import json
from fix_products_json import load_products_json

# BGN to EUR conversion rate (1 EUR = 1.95583 BGN, fixed rate)
BGN_TO_EUR = 1.95583

# Unified criteria for non-bestseller products (energy & support category)
UNIFIED_CRITERIA = [
    "Термогенеза",       # Thermogenesis
    "Енергия",           # Energy
    "Метаболизъм",       # Metabolism
    "Фокус",             # Focus
    "Отслабване",        # Weight loss
    "Изгаряне на мазнини", # Fat burning
    "Контрол на апетита" # Appetite control
]

def convert_bgn_to_eur(price_bgn):
    """Convert price from BGN to EUR"""
    return round(price_bgn / BGN_TO_EUR, 2)

def get_top_3_effects(product, is_bestseller=False):
    """
    Get top 3 effect bars based on unified criteria.
    For bestsellers, keep existing effects but limit to top 3.
    For others, use unified criteria.
    """
    current_effects = product.get('public_data', {}).get('effects', [])
    
    if is_bestseller:
        # For bestsellers, keep their unique effects but limit to top 3
        # Sort by value descending and take top 3
        sorted_effects = sorted(current_effects, key=lambda x: x.get('value', 0), reverse=True)
        return sorted_effects[:3]
    
    # For non-bestsellers, use unified criteria
    # Analyze product type to determine appropriate effects
    product_name = product.get('public_data', {}).get('name', '').lower()
    system_data = product.get('system_data', {})
    goals = system_data.get('goals', [])
    
    # Create effect bars based on product characteristics
    effects = []
    
    # Thermogenesis - high for fat burners
    if 'thermo' in product_name or 'burn' in product_name or 'fat' in product_name:
        effects.append({"label": "Термогенеза", "value": 85})
    else:
        effects.append({"label": "Термогенеза", "value": 70})
    
    # Energy - standard for all energy products
    effects.append({"label": "Енергия", "value": 80})
    
    # Metabolism or Fat burning based on product type
    if 'lipo' in product_name or 'fat' in product_name:
        effects.append({"label": "Изгаряне на мазнини", "value": 85})
    else:
        effects.append({"label": "Метаболизъм", "value": 75})
    
    return effects

def update_products_with_feedback():
    """Apply all user feedback updates"""
    
    print("=" * 80)
    print("APPLYING USER FEEDBACK UPDATES")
    print("=" * 80)
    
    # Load products
    data = load_products_json('backend/products.json')
    
    updates_summary = {
        'prices_converted': 0,
        'effects_updated': 0,
        'products_processed': 0
    }
    
    # Process each category
    for cat in data['categories']:
        if cat.get('type') != 'product_category':
            continue
        
        cat_title = cat.get('title', '')
        is_bestseller_cat = 'БЕСТСЕЛЪР' in cat_title
        
        print(f"\nProcessing category: {cat_title}")
        print(f"Bestseller category: {is_bestseller_cat}")
        print("-" * 80)
        
        for product in cat.get('products', []):
            updates_summary['products_processed'] += 1
            
            pub_data = product.get('public_data', {})
            name = pub_data.get('name', '')
            
            # 1. Convert price from BGN to EUR
            price_bgn = pub_data.get('price', 0)
            if price_bgn > 0:
                price_eur = convert_bgn_to_eur(price_bgn)
                pub_data['price_bgn'] = price_bgn  # Keep original BGN price
                pub_data['price'] = price_eur
                pub_data['currency'] = 'EUR'
                updates_summary['prices_converted'] += 1
                print(f"  ✓ {name}")
                print(f"    Price: {price_bgn} лв. → {price_eur} EUR")
            
            # 2. Standardize effects to top 3
            current_effects_count = len(pub_data.get('effects', []))
            new_effects = get_top_3_effects(product, is_bestseller_cat)
            pub_data['effects'] = new_effects
            
            if current_effects_count != 3:
                updates_summary['effects_updated'] += 1
                print(f"    Effects: {current_effects_count} → 3 bars")
                for eff in new_effects:
                    print(f"      • {eff['label']}: {eff['value']}")
    
    # Summary
    print("\n" + "=" * 80)
    print("UPDATE SUMMARY")
    print("=" * 80)
    print(f"Products processed: {updates_summary['products_processed']}")
    print(f"Prices converted to EUR: {updates_summary['prices_converted']}")
    print(f"Effect bars updated: {updates_summary['effects_updated']}")
    
    # Save updated products
    categories = data.get('categories', [])
    footer = data.get('footer', {})
    
    lines = []
    
    # Write categories with 4-space indentation
    for i, cat in enumerate(categories):
        cat_json = json.dumps(cat, ensure_ascii=False, indent=2)
        cat_lines = cat_json.split('\n')
        for line in cat_lines:
            lines.append('    ' + line)
        
        if i < len(categories) - 1:
            lines[-1] = lines[-1] + ','
    
    # Add footer
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
    
    print("\n✓ Updated backend/products.json")
    
    return updates_summary

if __name__ == '__main__':
    summary = update_products_with_feedback()
    
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)
    
    # Verify updates
    data = load_products_json('backend/products.json')
    
    print("\nSample products after update:")
    for cat in data['categories']:
        if cat.get('type') == 'product_category':
            print(f"\n{cat.get('title')}:")
            for prod in cat.get('products', [])[:2]:  # Show first 2 from each category
                pub = prod.get('public_data', {})
                print(f"  • {pub.get('name')}")
                print(f"    Price: {pub.get('price')} {pub.get('currency', 'EUR')}")
                print(f"    Effects: {len(pub.get('effects', []))} bars")
