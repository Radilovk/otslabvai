#!/usr/bin/env python3
"""
Fix the products.json file structure and load it properly.
"""
import json

def load_products_json(filepath):
    """Load and fix the products.json file if needed."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # The file structure is:
    # - Lines with 4-space indent: array of category objects
    # - Line 987: "  ]," - end of array with 2-space indent
    # - Lines with 2-space indent after 987: footer object
    
    lines = content.split('\n')
    
    # Find the line that ends the main array (2-space indent + "],")
    main_array_end = None
    for i, line in enumerate(lines):
        if line == '  ],':
            main_array_end = i
            break
    
    if main_array_end is None:
        raise ValueError("Could not find main array end")
    
    # Split content
    array_part = '\n'.join(lines[:main_array_end])
    rest_part = '\n'.join(lines[main_array_end:])
    
    # De-indent array part by 4 spaces
    array_lines = []
    for line in array_part.split('\n'):
        if line.startswith('    '):
            array_lines.append(line[4:])
        elif line.strip():  # non-empty line that doesn't start with 4 spaces
            array_lines.append(line)
        else:
            array_lines.append(line)
    
    # De-indent rest by 2 spaces
    rest_lines = []
    for line in rest_part.split('\n'):
        if line.startswith('  '):
            rest_lines.append(line[2:])
        elif line.strip():
            rest_lines.append(line)
        else:
            rest_lines.append(line)
    
    # Construct valid JSON
    # The rest starts with "], " so we need to wrap everything
    array_json = '[\n' + '\n'.join(array_lines) + '\n]'
    
    # Parse array to validate
    categories = json.loads(array_json)
    
    # Now handle the rest - it's just "], followed by footer"
    rest_content = '\n'.join(rest_lines)
    # Remove the leading ],
    if rest_content.strip().startswith('],'):
        rest_content = rest_content.strip()[2:].lstrip()
    
    # Parse footer if it exists
    footer = None
    if rest_content.strip():
        # Wrap in braces to make it valid
        footer_json = '{' + rest_content
        if not footer_json.rstrip().endswith('}'):
            footer_json += '\n}'
        try:
            footer_obj = json.loads(footer_json)
            if 'footer' in footer_obj:
                footer = footer_obj['footer']
        except:
            pass
    
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
