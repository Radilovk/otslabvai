#!/usr/bin/env python3
"""
Add missing packaging/variant information to products
"""

import json

def load_page_content():
    with open('/home/runner/work/otslabvai/otslabvai/backend/page_content.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def save_page_content(data):
    with open('/home/runner/work/otslabvai/otslabvai/backend/page_content.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def update_product_variants(product_id, variants):
    data = load_page_content()
    
    for component in data['page_content']:
        if component.get('type') == 'product_category' and 'products' in component:
            for product in component['products']:
                if product.get('product_id') == product_id:
                    product['public_data']['variants'] = variants
                    print(f"✓ Added variants for {product['public_data']['name']}")
                    save_page_content(data)
                    return True
    return False

def main():
    # Add variants for products missing packaging information
    
    # Fat No More - 120 capsules, 40 doses (3 caps per serving)
    update_product_variants('prod-16905', [
        {
            "title": "Fat No More - 120 капсули (40 дози)",
            "description": "Пълна опаковка - 3 капсули дневно",
            "url": "#"
        }
    ])
    
    # Thermo Caps - 120 capsules, 30 doses (4 caps per serving)
    update_product_variants('prod-24527', [
        {
            "title": "Thermo Caps - 120 капсули (30 дози)",
            "description": "Стандартна опаковка - 4 капсули дневно",
            "url": "#"
        }
    ])
    
    # Essential Fat Burner - 60 capsules, 30 doses (2 caps per serving)
    update_product_variants('prod-37086', [
        {
            "title": "Essential Fat Burner - 60 капсули (30 дози)",
            "description": "Месечна опаковка - 2 капсули дневно",
            "url": "#"
        }
    ])
    
    # Burn4All Extreme - 120 capsules, 40 doses (3 caps per serving)
    update_product_variants('prod-24605', [
        {
            "title": "Burn4All Extreme - 120 капсули (40 дози)",
            "description": "Екстремна формула - до 3 капсули дневно",
            "url": "#"
        }
    ])
    
    # Fat Transporter - 180 capsules, 90 doses (2 caps per serving, 3x daily = 6 caps)
    update_product_variants('prod-5177', [
        {
            "title": "Fat Transporter - 180 капсули (30 дози)",
            "description": "Месечна опаковка - 6 капсули дневно (2x3)",
            "url": "#"
        }
    ])
    
    # Lipo 6 L-Carnitine - 120 capsules, 60 doses (2 caps per serving, 2x daily = 4 caps)
    update_product_variants('prod-31', [
        {
            "title": "Lipo 6 L-Carnitine - 120 капсули (60 дози)",
            "description": "Liqui-caps опаковка - 2 капсули 2 пъти дневно",
            "url": "#"
        }
    ])
    
    # Lipo 6 Black - 120 capsules, 40-60 doses (varies based on tolerance)
    update_product_variants('prod-742', [
        {
            "title": "Lipo 6 Black - 120 капсули (40-60 дози)",
            "description": "Екстремна формула - 2-3 капсули дневно",
            "url": "#"
        }
    ])
    
    print("\n✅ All packaging information added successfully!")

if __name__ == "__main__":
    main()
