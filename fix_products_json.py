#!/usr/bin/env python3
"""
Load the products.json file structure.
The file now has the correct structure: {"product_categories": [...]}
"""
import json

def load_products_json(filepath):
    """Load the products.json file with the correct structure."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle both old malformed structure and new correct structure
    if 'product_categories' in data:
        # New correct structure: {"product_categories": [...]}
        categories = data['product_categories']
        footer = data.get('footer', None)
    else:
        # Try to handle old malformed structure if it still exists
        try:
            content = f.read()
            lines = content.split('\n')
            
            # Find the line that ends the main array (2-space indent + "],")
            main_array_end = None
            for i, line in enumerate(lines):
                if line == '  ],':
                    main_array_end = i
                    break
            
            if main_array_end is None:
                raise ValueError("Could not parse old format")
            
            # Split content
            array_part = '\n'.join(lines[:main_array_end])
            rest_part = '\n'.join(lines[main_array_end:])
            
            # De-indent array part by 4 spaces
            array_lines = []
            for line in array_part.split('\n'):
                if line.startswith('    '):
                    array_lines.append(line[4:])
                elif line.strip():
                    array_lines.append(line)
                else:
                    array_lines.append(line)
            
            # Construct valid JSON
            array_json = '[\n' + '\n'.join(array_lines) + '\n]'
            categories = json.loads(array_json)
            footer = None
        except:
            # If all else fails, return empty
            categories = []
            footer = None
    
    # Return structured data
    return {
        'categories': categories,
        'footer': footer
    }

if __name__ == '__main__':
    data = load_products_json('backend/products.json')
    print(f"Loaded {len(data['categories'])} categories")
    
    for cat in data['categories']:
        if cat.get('type') == 'product_category':
            print(f"  - {cat.get('title')}: {len(cat.get('products', []))} products")
    
    if data['footer']:
        print(f"\nFooter: {list(data['footer'].keys())}")
