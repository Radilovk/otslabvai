#!/usr/bin/env python3
"""
Generate optimized thumbnails for product images.
Thumbnails are used on the index page for faster loading,
while full-size images are used on product detail pages.
"""

import os
import json
from pathlib import Path
from PIL import Image

# Configuration
THUMBNAIL_SIZE = (300, 300)  # Max width/height for thumbnails
THUMBNAIL_QUALITY = 85  # JPEG quality (1-100)
THUMBNAIL_SUFFIX = '-thumb'  # Suffix for thumbnail files

def create_thumbnail(input_path, output_path, size=THUMBNAIL_SIZE, quality=THUMBNAIL_QUALITY):
    """
    Create an optimized thumbnail from an image.
    
    Args:
        input_path: Path to the original image
        output_path: Path where thumbnail will be saved
        size: Max dimensions (width, height)
        quality: JPEG quality (1-100)
    """
    try:
        with Image.open(input_path) as img:
            # Convert RGBA to RGB for JPEG
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create a white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            
            # Resize maintaining aspect ratio
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save as JPEG with optimization
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
            # Get file sizes
            original_size = os.path.getsize(input_path) / 1024  # KB
            thumbnail_size = os.path.getsize(output_path) / 1024  # KB
            
            print(f"  ✓ Created thumbnail: {Path(output_path).name}")
            print(f"    Original: {original_size:.1f}KB → Thumbnail: {thumbnail_size:.1f}KB ({thumbnail_size/original_size*100:.0f}%)")
            
            return True
    except Exception as e:
        print(f"  ✗ Error creating thumbnail: {e}")
        return False

def process_product_images(images_dir='images/products'):
    """
    Process all product images and create thumbnails.
    
    Args:
        images_dir: Base directory containing product images
    """
    images_path = Path(images_dir)
    
    if not images_path.exists():
        print(f"Error: Directory '{images_dir}' not found")
        return
    
    print("Starting thumbnail generation...")
    print(f"Image directory: {images_path.absolute()}")
    print(f"Thumbnail size: {THUMBNAIL_SIZE[0]}x{THUMBNAIL_SIZE[1]}px")
    print(f"Quality: {THUMBNAIL_QUALITY}%")
    print()
    
    total_processed = 0
    total_created = 0
    
    # First, process images in the root products directory
    print(f"Processing: {images_path.name} (root)")
    for image_file in images_path.glob('*'):
        if not image_file.is_file():
            continue
        
        ext = image_file.suffix.lower()
        if ext not in ['.png', '.jpg', '.jpeg', '.webp']:
            continue
        
        # Skip if already a thumbnail
        if THUMBNAIL_SUFFIX in image_file.stem:
            continue
        
        total_processed += 1
        
        # Create thumbnail filename
        thumbnail_name = f"{image_file.stem}{THUMBNAIL_SUFFIX}.jpg"
        thumbnail_path = images_path / thumbnail_name
        
        # Skip if thumbnail already exists and is newer than original
        if thumbnail_path.exists():
            original_mtime = os.path.getmtime(image_file)
            thumbnail_mtime = os.path.getmtime(thumbnail_path)
            if thumbnail_mtime >= original_mtime:
                print(f"  → Thumbnail exists: {thumbnail_name}")
                total_created += 1
                continue
        
        # Create the thumbnail
        if create_thumbnail(image_file, thumbnail_path):
            total_created += 1
    
    print()
    
    # Then process each product subdirectory
    for product_dir in images_path.iterdir():
        if not product_dir.is_dir() or product_dir.name.startswith('.'):
            continue
        
        print(f"Processing: {product_dir.name}")
        
        # Find all image files in the product directory
        for image_file in product_dir.glob('*'):
            # Skip if not an image or already a thumbnail
            if not image_file.is_file():
                continue
            
            ext = image_file.suffix.lower()
            if ext not in ['.png', '.jpg', '.jpeg', '.webp']:
                continue
            
            # Skip if already a thumbnail
            if THUMBNAIL_SUFFIX in image_file.stem:
                continue
            
            total_processed += 1
            
            # Create thumbnail filename
            thumbnail_name = f"{image_file.stem}{THUMBNAIL_SUFFIX}.jpg"
            thumbnail_path = product_dir / thumbnail_name
            
            # Skip if thumbnail already exists and is newer than original
            if thumbnail_path.exists():
                original_mtime = os.path.getmtime(image_file)
                thumbnail_mtime = os.path.getmtime(thumbnail_path)
                if thumbnail_mtime >= original_mtime:
                    print(f"  → Thumbnail exists: {thumbnail_name}")
                    total_created += 1
                    continue
            
            # Create the thumbnail
            if create_thumbnail(image_file, thumbnail_path):
                total_created += 1
        
        print()
    
    print(f"Summary:")
    print(f"  Images processed: {total_processed}")
    print(f"  Thumbnails created/existing: {total_created}")
    print(f"  Success rate: {total_created/total_processed*100:.0f}%" if total_processed > 0 else "  No images found")

def update_product_json_with_thumbnails(json_path='backend/page_content.json'):
    """
    Update product JSON to include thumbnail URLs alongside original image URLs.
    
    Args:
        json_path: Path to the page_content.json file
    """
    json_file = Path(json_path)
    
    if not json_file.exists():
        print(f"Error: JSON file '{json_path}' not found")
        return False
    
    print(f"\nUpdating product JSON: {json_path}")
    
    try:
        # Load JSON
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        updated_count = 0
        
        # Process each component
        for component in data.get('page_content', []):
            if component.get('type') != 'product_category':
                continue
            
            # Process each product
            for product in component.get('products', []):
                public_data = product.get('public_data', {})
                image_url = public_data.get('image_url', '')
                
                if not image_url:
                    continue
                
                # Generate thumbnail URL by adding -thumb before extension
                # e.g., /images/products/product.png → /images/products/product-thumb.jpg
                path_parts = image_url.rsplit('.', 1)
                if len(path_parts) == 2:
                    thumbnail_url = f"{path_parts[0]}{THUMBNAIL_SUFFIX}.jpg"
                    
                    # Add thumbnail_url field
                    public_data['thumbnail_url'] = thumbnail_url
                    updated_count += 1
        
        # Save updated JSON
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"  ✓ Updated {updated_count} products with thumbnail URLs")
        return True
        
    except Exception as e:
        print(f"  ✗ Error updating JSON: {e}")
        return False

if __name__ == '__main__':
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Process images
    process_product_images()
    
    # Update JSON
    update_product_json_with_thumbnails()
    
    print("\n✓ Thumbnail generation complete!")
