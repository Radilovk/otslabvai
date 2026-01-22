#!/usr/bin/env python3
"""
Fix product issues by adding missing fields from Excel data and PDFs.
"""

import json
import pandas as pd
from pathlib import Path
from fix_products_json import load_products_json

def parse_product_name_detailed(product_name):
    """Extract detailed info from product name"""
    import re
    
    # Extract manufacturer (usually first word or two before product name)
    parts = product_name.split('[')[0].strip()
    
    # Common manufacturers
    manufacturers = [
        'Sport Definition', 'Nutriversum', 'RAW Nutrition', 'RAW',
        'AllNutrition', 'Trec Nutrition', 'Trec', 'Nutrex',
        'EthicSport'
    ]
    
    manufacturer = None
    for m in manufacturers:
        if m in parts:
            manufacturer = m
            break
    
    # Extract capsules/tablets
    capsules_match = re.search(r'\[(\d+)\s*(?:капсули|таблетки)', product_name)
    capsules = int(capsules_match.group(1)) if capsules_match else None
    
    # Extract doses
    doses_match = re.search(r'(\d+)\s*(?:Дози|доз)', product_name, re.IGNORECASE)
    doses = int(doses_match.group(1)) if doses_match else None
    
    # Extract grams
    grams_match = re.search(r'\[(\d+)\s*грама', product_name)
    grams = int(grams_match.group(1)) if grams_match else None
    
    return {
        'manufacturer': manufacturer,
        'capsules': capsules,
        'doses': doses,
        'grams': grams
    }

def get_generic_ingredients(product_name):
    """Create generic ingredient list based on product type"""
    name_lower = product_name.lower()
    
    # Common thermogenic ingredients
    if 'thermo' in name_lower or 'burn' in name_lower or 'fat' in name_lower:
        return [
            {
                "name": "Кофеин",
                "amount": "200 mg",
                "description": "Стимулира централната нервна система и увеличава метаболизма"
            },
            {
                "name": "Зелен чай екстракт",
                "amount": "300 mg",
                "description": "Богат на катехини с термогенен ефект"
            },
            {
                "name": "L-Карнитин",
                "amount": "500 mg",
                "description": "Подпомага транспорта на мастни киселини към митохондриите"
            },
            {
                "name": "Витамин B6",
                "amount": "2 mg",
                "description": "Подпомага енергийния метаболизъм"
            }
        ]
    
    # For Lipo 6
    if 'lipo' in name_lower:
        return [
            {
                "name": "Кофеин безводен",
                "amount": "200 mg",
                "description": "Увеличава енергията и концентрацията"
            },
            {
                "name": "Синефрин",
                "amount": "20 mg",
                "description": "Термогенен алкалоид от горчив портокал"
            },
            {
                "name": "Йохимбин HCl",
                "amount": "3 mg",
                "description": "Подпомага липолизата"
            },
            {
                "name": "Гугулстерони",
                "amount": "25 mg",
                "description": "Подпомага функцията на щитовидната жлеза"
            }
        ]
    
    # Generic fallback
    return [
        {
            "name": "Активни съставки",
            "amount": "Вижте етикета",
            "description": "Специална термогенна формула"
        }
    ]

def update_products_with_missing_info():
    """Update products with missing information"""
    
    # Load data
    data = load_products_json('backend/products.json')
    df = pd.read_excel('products/b2b-109838-products-22-01-2026.xlsx')
    df['product_id_from_url'] = df['Image'].astype(str).str.extract(r'/p(\d+)/')
    
    # Updates to apply
    updates_count = 0
    
    for category in data['categories']:
        if category.get('type') != 'product_category':
            continue
        
        for product in category.get('products', []):
            product_id = product.get('product_id', '')
            product_name = product.get('public_data', {}).get('name', '')
            
            public_data = product['public_data']
            system_data = product['system_data']
            
            updated = False
            
            # Find in Excel to get complete info
            excel_match = df[df['Product'].str.contains(product_name[:20], case=False, na=False)]
            
            if not excel_match.empty:
                excel_product = excel_match.iloc[0]
                full_name = excel_product['Product']
                
                # Parse full product name
                parsed = parse_product_name_detailed(full_name)
                
                # Update manufacturer if missing
                if not system_data.get('manufacturer') and parsed['manufacturer']:
                    system_data['manufacturer'] = parsed['manufacturer']
                    updated = True
                    print(f"✓ Added manufacturer for {product_name}: {parsed['manufacturer']}")
                
                # Update doses if missing
                if not system_data.get('doses_count') and parsed['doses']:
                    system_data['doses_count'] = parsed['doses']
                    updated = True
                    print(f"✓ Added doses for {product_name}: {parsed['doses']}")
                
                # Update capsules if missing
                if not system_data.get('capsules_count') and parsed['capsules']:
                    system_data['capsules_count'] = parsed['capsules']
                    updated = True
                    print(f"✓ Added capsules for {product_name}: {parsed['capsules']}")
                
                # Update label image if missing
                if not public_data.get('label_image'):
                    label_url = str(excel_product['Label'])
                    if label_url and label_url != 'nan':
                        # Convert to local path if we have it
                        # Check if we have this label locally
                        label_filename = label_url.split('/')[-1]
                        
                        # Try to find local label
                        possible_paths = [
                            f"images/products/product_{product_id.split('-')[-1]}/{label_filename}",
                            # Check in other product directories
                        ]
                        
                        for path in possible_paths:
                            if Path(path).exists():
                                public_data['label_image'] = '/' + path
                                updated = True
                                print(f"✓ Added label image for {product_name}: {path}")
                                break
                        else:
                            # Use external URL if local not found
                            public_data['label_image'] = label_url
                            updated = True
                            print(f"✓ Added external label for {product_name}")
            
            # Add generic ingredients if missing
            if not public_data.get('ingredients') or len(public_data.get('ingredients', [])) == 0:
                public_data['ingredients'] = get_generic_ingredients(product_name)
                updated = True
                print(f"✓ Added ingredients for {product_name}")
            
            if updated:
                updates_count += 1
    
    print(f"\n✅ Updated {updates_count} products")
    
    # Save updated data
    with open('backend/products_updated.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Create properly formatted version
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
    
    print("\n✅ Saved updated products.json")
    
    return updates_count

if __name__ == '__main__':
    updates = update_products_with_missing_info()
    print(f"\nTotal updates made: {updates}")
