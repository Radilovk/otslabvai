#!/usr/bin/env python3
"""
Validate products have all required fields and generate a report.
"""

import json
from fix_products_json import load_products_json

def validate_product(product, is_bestseller=False):
    """Validate a product has all required fields"""
    issues = []
    
    public_data = product.get('public_data', {})
    system_data = product.get('system_data', {})
    
    # Skip detailed validation for bestsellers
    if is_bestseller:
        return []
    
    # 1. General description
    description = public_data.get('description', '')
    if not description or len(description) < 50:
        issues.append('Липсва подробно общо описание (минимум 50 символа)')
    
    # 2. Price
    price = public_data.get('price')
    if not price or price <= 0:
        issues.append('Липсва цена или цената е невалидна')
    
    # 3. Manufacturer
    manufacturer = system_data.get('manufacturer', '')
    if not manufacturer:
        issues.append('Липсва производител')
    
    # 4. Capsules/tablets/weight
    capsules = system_data.get('capsules_count')
    grams = system_data.get('weight_grams')
    app_type = system_data.get('application_type', '')
    
    if 'Capsule' in app_type or 'Tablet' in app_type:
        if not capsules:
            issues.append('Липсва брой капсули/таблетки')
    elif 'Powder' in app_type:
        if not grams:
            issues.append('Липсва грамаж на прах')
    
    # 5. Number of doses
    doses = system_data.get('doses_count')
    if not doses:
        issues.append('Липсва брой дози')
    
    # 6. Composition (ingredients)
    ingredients = public_data.get('ingredients', [])
    if not ingredients or len(ingredients) == 0:
        issues.append('Липсва състав (ingredients)')
    
    # 7. Intake recommendations
    protocol = system_data.get('protocol_hint', '')
    if not protocol or len(protocol) < 10:
        issues.append('Липсват препоръки за прием')
    
    # 8. Main image
    image_url = public_data.get('image_url', '')
    if not image_url:
        issues.append('Липсва основна снимка')
    
    # 9. Label image
    label_image = public_data.get('label_image', '')
    if not label_image:
        issues.append('Липсва снимка на етикета')
    
    return issues

def main():
    """Generate validation report"""
    print("="*80)
    print("PRODUCT VALIDATION REPORT")
    print("="*80)
    
    # Load products
    data = load_products_json('backend/products.json')
    
    all_issues = {}
    total_products = 0
    products_with_issues = 0
    
    for category in data['categories']:
        if category.get('type') != 'product_category':
            continue
        
        category_title = category.get('title', '')
        category_id = category.get('id', '')
        
        # Check if this is the bestsellers category
        is_bestseller_category = 'bestseller' in category_title.lower() or 'бестселър' in category_title.lower()
        
        print(f"\n{'='*80}")
        print(f"Category: {category_title}")
        print(f"Bestseller Category: {'Yes (skipping detailed validation)' if is_bestseller_category else 'No'}")
        print(f"{'='*80}")
        
        for product in category.get('products', []):
            total_products += 1
            
            product_id = product.get('product_id', '')
            product_name = product.get('public_data', {}).get('name', '')
            
            issues = validate_product(product, is_bestseller_category)
            
            if issues:
                products_with_issues += 1
                all_issues[product_id] = {
                    'name': product_name,
                    'category': category_title,
                    'issues': issues
                }
                
                print(f"\n⚠️  {product_name} ({product_id})")
                for issue in issues:
                    print(f"     - {issue}")
            else:
                print(f"\n✅  {product_name} ({product_id}) - Всички полета са налични")
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"Total products checked: {total_products}")
    print(f"Products with issues: {products_with_issues}")
    print(f"Products valid: {total_products - products_with_issues}")
    
    if all_issues:
        print(f"\n{'='*80}")
        print("DETAILED ISSUES BY PRODUCT")
        print(f"{'='*80}")
        
        for product_id, info in all_issues.items():
            print(f"\n{info['name']} ({product_id})")
            print(f"Category: {info['category']}")
            print("Issues:")
            for issue in info['issues']:
                print(f"  - {issue}")
    
    # Save report
    report_file = 'backend/validation_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'total_products': total_products,
            'products_with_issues': products_with_issues,
            'issues': all_issues
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\nReport saved to {report_file}")
    
    return len(all_issues) == 0

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
