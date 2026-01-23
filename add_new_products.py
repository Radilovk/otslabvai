#!/usr/bin/env python3
"""
Add new products from Excel to products.json with images from extracted archives.
"""

import json
import pandas as pd
from pathlib import Path
from fix_products_json import load_products_json

# Product mappings from our analysis
PRODUCT_MAPPINGS = {
    '16905': {
        'search_term': 'Fat No More',
        'manufacturer': 'Sport Definition',
        'category': 'fat-burners'
    },
    '24527': {
        'search_term': 'Thermo Caps',
        'manufacturer': 'Nutriversum',
        'category': 'fat-burners'
    },
    '37086': {
        'search_term': 'Essential Fat Burner',
        'manufacturer': 'RAW Nutrition',
        'category': 'fat-burners'
    },
    '24605': {
        'search_term': 'Burn4All Extreme',
        'manufacturer': 'AllNutrition',
        'category': 'fat-burners'
    },
    '5177': {
        'search_term': 'Fat Transporter',
        'manufacturer': 'Trec Nutrition',
        'category': 'fat-burners'
    },
    '31': {
        'search_term': 'Lipo 6',
        'manufacturer': 'Nutrex',
        'category': 'fat-burners'
    },
    '742': {
        'search_term': 'Lipo 6 Black',
        'manufacturer': 'Nutrex',
        'category': 'fat-burners'
    },
}

def load_image_mapping():
    """Load the image mapping created by process_product_images.py"""
    with open('backend/image_mapping.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def load_excel_products():
    """Load products from Excel file"""
    df = pd.read_excel('products/b2b-109838-products-22-01-2026.xlsx')
    df['product_id_from_url'] = df['Image'].astype(str).str.extract(r'/p(\d+)/')
    return df

def find_excel_product(df, search_term):
    """Find product in Excel by search term"""
    matches = df[df['Product'].str.contains(search_term, case=False, na=False)]
    if not matches.empty:
        return matches.iloc[0]
    return None

def parse_product_name(product_name):
    """Extract capsule count, dose count, and weight from product name"""
    import re
    
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
        'capsules': capsules,
        'doses': doses,
        'grams': grams
    }

def create_product_entry(product_id, excel_row, image_data, manufacturer):
    """Create a product entry for products.json"""
    
    product_name = excel_row['Product']
    parsed = parse_product_name(product_name)
    
    # Extract main product name (before brackets)
    main_name = product_name.split('[')[0].strip()
    # Remove manufacturer prefix if present
    if manufacturer in main_name:
        main_name = main_name.replace(manufacturer, '').strip()
    
    # Create clean product ID
    clean_id = f"prod-{product_id}"
    
    # Get images
    main_images = image_data.get('images', {}).get('main', [])
    label_images = image_data.get('images', {}).get('label', [])
    
    main_image = f"/{main_images[0]}" if main_images else ""
    label_image = f"/{label_images[0]}" if label_images else ""
    
    # Parse price
    price_str = str(excel_row['Price']).replace(' лв.', '').replace(',', '.')
    try:
        price = float(price_str)
    except:
        price = 0.0
    
    # Create product structure matching existing format
    product = {
        "product_id": clean_id,
        "public_data": {
            "name": main_name,
            "tagline": f"{manufacturer} - Термогенен фет бърнер",
            "price": price,
            "description": f"{main_name} е мощен термогенен продукт за отслабване и увеличаване на енергията.",
            "image_url": main_image,
            "label_image": label_image,
            "effects": [
                {
                    "label": "Термогенеза",
                    "value": 85
                },
                {
                    "label": "Енергия",
                    "value": 80
                },
                {
                    "label": "Фокус",
                    "value": 75
                },
                {
                    "label": "Отслабване",
                    "value": 80
                }
            ],
            "ingredients": [],
            "faq": [],
            "variants": []
        },
        "system_data": {
            "manufacturer": manufacturer,
            "application_type": "Oral / Capsules" if parsed['capsules'] else "Oral / Powder",
            "capsules_count": parsed['capsules'],
            "doses_count": parsed['doses'],
            "weight_grams": parsed['grams'],
            "goals": [
                "weight-loss",
                "energy",
                "thermogenesis"
            ],
            "target_profile": "Хора, които искат да увеличат енергията и да ускорят метаболизма.",
            "protocol_hint": f"Приемайте {1 if parsed['doses'] and parsed['doses'] < 60 else 2-3} капсули дневно с храна.",
            "synergy_products": [],
            "safety_warnings": "Не превишавайте препоръчителната доза.",
            "inventory": 15
        }
    }
    
    return product

def main():
    """Main function to add new products"""
    print("Loading data...")
    
    # Load existing products
    products_data = load_products_json('backend/products.json')
    
    # Load Excel and image mapping
    excel_df = load_excel_products()
    image_mapping = load_image_mapping()
    
    # Find the fat-burners category
    fat_burners_category = None
    for cat in products_data['categories']:
        if cat.get('id') == 'fat-burners':
            fat_burners_category = cat
            break
    
    if not fat_burners_category:
        print("Error: Could not find fat-burners category")
        return
    
    print(f"\nFound category: {fat_burners_category['title']}")
    print(f"Current products: {len(fat_burners_category.get('products', []))}")
    
    # Add new products
    new_products = []
    for product_id, mapping in PRODUCT_MAPPINGS.items():
        print(f"\nProcessing product ID {product_id}...")
        
        # Find in Excel
        excel_product = find_excel_product(excel_df, mapping['search_term'])
        if excel_product is None:
            print(f"  WARNING: Could not find '{mapping['search_term']}' in Excel")
            continue
        
        # Get image data
        image_data = image_mapping.get(product_id, {})
        if not image_data:
            print(f"  WARNING: No image data for product {product_id}")
            continue
        
        # Create product entry
        product = create_product_entry(
            product_id,
            excel_product,
            image_data,
            mapping['manufacturer']
        )
        
        print(f"  Created: {product['public_data']['name']}")
        print(f"  Price: {product['public_data']['price']} лв.")
        print(f"  Main image: {product['public_data']['image_url']}")
        print(f"  Label image: {product['public_data']['label_image']}")
        
        new_products.append(product)
    
    # Add to category
    fat_burners_category['products'].extend(new_products)
    
    print(f"\n\nAdded {len(new_products)} new products")
    print(f"Total products in category: {len(fat_burners_category['products'])}")
    
    # Save updated products.json
    print("\nSaving updated products.json...")
    
    # We need to reconstruct the file with proper formatting
    # Read original file to preserve structure
    with open('backend/products.json', 'r', encoding='utf-8') as f:
        original_lines = f.readlines()
    
    # Find where to insert new products (before the closing of products array)
    # This is complex, so let's create a new properly formatted file
    
    # For now, save to a new file
    output_file = 'backend/products_updated.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(products_data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {output_file}")
    print("\nPlease review the file and then rename it to products.json")

if __name__ == '__main__':
    main()
