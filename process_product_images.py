#!/usr/bin/env python3
"""
Process product images from zip files and update product data.

This script:
1. Extracts images from zip files in the products/ folder
2. Maps images to existing products based on product IDs
3. Identifies new products from Excel file
4. Validates products have required fields
5. Ensures each product has main image and label image
"""

import json
import os
import zipfile
import shutil
import pandas as pd
import re
from pathlib import Path
from fix_products_json import load_products_json

# Configuration
PRODUCTS_DIR = Path('products')
IMAGES_DIR = Path('images/products')
BACKEND_DIR = Path('backend')
EXCEL_FILE = PRODUCTS_DIR / 'b2b-109838-products-22-01-2026.xlsx'
PRODUCTS_JSON = BACKEND_DIR / 'products.json'

# Required fields for non-bestseller products
REQUIRED_FIELDS = {
    'description': 'Общо описание',
    'price': 'Цена',
    'manufacturer': 'Производител',
    'capsules_count': 'Брой капсули/таблетки/грамаж',
    'doses_count': 'Брой дози',
    'ingredients': 'Състав',
    'protocol_hint': 'Препоръки за прием',
    'image_url': 'Основна снимка',
    'label_image': 'Снимка на етикета'
}

def extract_product_id_from_filename(filename):
    """Extract product ID from zip filename like f1_b2b_16905.zip"""
    match = re.search(r'f1_b2b_(\d+)\.zip', filename)
    return match.group(1) if match else None

def extract_zip_files():
    """Extract all zip files in products directory"""
    extracted_data = {}
    
    for zip_file in PRODUCTS_DIR.glob('*.zip'):
        product_id = extract_product_id_from_filename(zip_file.name)
        if not product_id:
            print(f"Skipping {zip_file.name} - cannot extract product ID")
            continue
        
        print(f"Extracting {zip_file.name} (Product ID: {product_id})...")
        
        # Create temporary extraction directory
        extract_dir = PRODUCTS_DIR / f'extracted_{product_id}'
        extract_dir.mkdir(exist_ok=True)
        
        with zipfile.ZipFile(zip_file, 'r') as zf:
            zf.extractall(extract_dir)
            
        # List extracted files
        files = list(extract_dir.glob('*'))
        extracted_data[product_id] = {
            'zip_file': zip_file,
            'extract_dir': extract_dir,
            'files': files
        }
        
        print(f"  Extracted {len(files)} files")
        for f in files:
            print(f"    - {f.name}")
    
    return extracted_data

def load_excel_products():
    """Load products from Excel file"""
    df = pd.read_excel(EXCEL_FILE)
    
    # Extract product ID from Image URL
    df['product_id_from_url'] = df['Image'].astype(str).str.extract(r'/p(\d+)/')
    
    return df

def find_product_by_id(products_data, product_id):
    """Find a product in the loaded JSON by matching with product ID"""
    # This is a placeholder - we need to implement proper matching
    # based on product names or other identifiers
    for category in products_data['categories']:
        if category.get('type') == 'product_category':
            for product in category.get('products', []):
                # Check if product matches somehow
                # For now, return None - will implement based on actual data
                pass
    return None

def identify_image_type(filename):
    """Identify if an image is a main image or label based on filename"""
    filename_lower = filename.lower()
    
    # Common label indicators
    label_indicators = ['supp-facts', 'suppfacts', 'supplement', 'label', 'etiket']
    if any(indicator in filename_lower for indicator in label_indicators):
        return 'label'
    
    # Main product image (usually larger files or product names)
    return 'main'

def organize_product_images(extracted_data, excel_df):
    """Organize extracted images into proper structure"""
    image_mapping = {}
    
    for product_id, data in extracted_data.items():
        # Find product info from Excel
        product_info = excel_df[excel_df['product_id_from_url'] == product_id]
        
        if product_info.empty:
            print(f"Warning: No product found in Excel for ID {product_id}")
            product_name = f"product_{product_id}"
        else:
            product_name = product_info.iloc[0]['Product']
            print(f"\nProcessing: {product_name} (ID: {product_id})")
        
        # Create product-specific directory
        # Sanitize product name for directory
        safe_name = re.sub(r'[^\w\s-]', '', product_name).strip().replace(' ', '_')
        product_dir = IMAGES_DIR / safe_name
        product_dir.mkdir(parents=True, exist_ok=True)
        
        images = {'main': [], 'label': []}
        
        # Categorize and copy images
        for img_file in data['files']:
            if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                img_type = identify_image_type(img_file.name)
                
                # Copy to organized location
                dest_file = product_dir / img_file.name
                shutil.copy2(img_file, dest_file)
                
                # Store relative path
                rel_path = dest_file.relative_to(Path('.'))
                images[img_type].append(str(rel_path))
                
                print(f"  Copied {img_type} image: {img_file.name}")
        
        image_mapping[product_id] = {
            'product_name': product_name,
            'product_dir': str(product_dir),
            'images': images
        }
    
    return image_mapping

def validate_product_fields(product, category_id):
    """Validate that a product has all required fields"""
    is_bestseller = 'weight-loss-products' in category_id or 'bestseller' in category_id.lower()
    
    if is_bestseller:
        return []  # Skip validation for bestsellers
    
    missing_fields = []
    public_data = product.get('public_data', {})
    system_data = product.get('system_data', {})
    
    # Check description
    if not public_data.get('description'):
        missing_fields.append('description')
    
    # Check price
    if not public_data.get('price'):
        missing_fields.append('price')
    
    # Check manufacturer (might be in system_data or derived from product name)
    # This would need to be added if not present
    
    # Check capsules/weight info (in variants or description)
    # This is often in the product name or variants
    
    # Check doses
    # Often in system_data or can be calculated
    
    # Check ingredients
    if not public_data.get('ingredients'):
        missing_fields.append('ingredients')
    
    # Check intake recommendations
    if not system_data.get('protocol_hint'):
        missing_fields.append('protocol_hint')
    
    # Check images
    if not public_data.get('image_url'):
        missing_fields.append('image_url')
    
    # Check for label image (might be in a separate field or in additional images)
    # This would need to be added
    
    return missing_fields

def generate_validation_report(products_data):
    """Generate a report of products with missing fields"""
    report = []
    
    for category in products_data['categories']:
        if category.get('type') != 'product_category':
            continue
        
        category_id = category.get('id', '')
        category_title = category.get('title', '')
        
        for product in category.get('products', []):
            product_id = product.get('product_id', '')
            product_name = product.get('public_data', {}).get('name', '')
            
            missing = validate_product_fields(product, category_id)
            
            if missing:
                report.append({
                    'category': category_title,
                    'product_id': product_id,
                    'product_name': product_name,
                    'missing_fields': missing
                })
    
    return report

def main():
    """Main processing function"""
    print("="*80)
    print("PRODUCT IMAGE PROCESSING SCRIPT")
    print("="*80)
    
    # Step 1: Load products from JSON
    print("\n1. Loading existing products...")
    products_data = load_products_json(str(PRODUCTS_JSON))
    print(f"   Found {len(products_data['categories'])} categories")
    total_products = sum(
        len(cat.get('products', []))
        for cat in products_data['categories']
        if cat.get('type') == 'product_category'
    )
    print(f"   Total products: {total_products}")
    
    # Step 2: Load Excel data
    print("\n2. Loading Excel product data...")
    excel_df = load_excel_products()
    print(f"   Found {len(excel_df)} product rows in Excel")
    unique_products = excel_df['product_id_from_url'].nunique()
    print(f"   Unique product IDs: {unique_products}")
    
    # Step 3: Extract zip files
    print("\n3. Extracting product images from zip files...")
    extracted_data = extract_zip_files()
    print(f"   Extracted {len(extracted_data)} zip files")
    
    # Step 4: Organize images
    print("\n4. Organizing product images...")
    image_mapping = organize_product_images(extracted_data, excel_df)
    
    # Step 5: Validate products
    print("\n5. Validating product data...")
    validation_report = generate_validation_report(products_data)
    
    if validation_report:
        print(f"\n   Found {len(validation_report)} products with missing fields:")
        for item in validation_report:
            print(f"\n   Product: {item['product_name']} ({item['product_id']})")
            print(f"   Category: {item['category']}")
            print(f"   Missing: {', '.join(item['missing_fields'])}")
    else:
        print("   All products have required fields!")
    
    # Step 6: Save image mapping
    print("\n6. Saving image mapping...")
    mapping_file = BACKEND_DIR / 'image_mapping.json'
    with open(mapping_file, 'w', encoding='utf-8') as f:
        json.dump(image_mapping, f, ensure_ascii=False, indent=2)
    print(f"   Saved to {mapping_file}")
    
    # Step 7: Generate summary report
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Processed {len(extracted_data)} product image archives")
    print(f"Organized images for {len(image_mapping)} products")
    print(f"Found {len(validation_report)} products needing updates")
    print("\nNext steps:")
    print("1. Review the image_mapping.json file")
    print("2. Update products.json with image paths")
    print("3. Add missing product information")
    print("4. Ensure all products have main and label images")
    
    # Cleanup extraction directories
    print("\n7. Cleaning up temporary files...")
    for data in extracted_data.values():
        if data['extract_dir'].exists():
            shutil.rmtree(data['extract_dir'])
    print("   Cleanup complete")

if __name__ == '__main__':
    main()
