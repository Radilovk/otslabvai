#!/usr/bin/env node

/**
 * Backend JSON Validation Script
 * 
 * This script validates the backend JSON files and checks for:
 * - Valid JSON syntax
 * - Required fields
 * - Product count consistency
 * - Duplicate product IDs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateJSON(filename) {
  log(`\n📄 Validating ${filename}...`, 'blue');
  
  try {
    const filePath = path.join(__dirname, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    log(`✓ Valid JSON syntax`, 'green');
    return data;
  } catch (error) {
    log(`✗ JSON syntax error: ${error.message}`, 'red');
    return null;
  }
}

function validatePageContent(data) {
  const errors = [];
  const warnings = [];
  
  // Check required top-level fields
  if (!data.settings) errors.push('Missing "settings" object');
  if (!data.navigation) errors.push('Missing "navigation" array');
  if (!data.page_content) errors.push('Missing "page_content" array');
  if (!data.footer) errors.push('Missing "footer" object');
  
  if (data.page_content) {
    // Count product categories
    const productCategories = data.page_content.filter(
      component => component.type === 'product_category'
    );
    
    log(`  Found ${productCategories.length} product categories`, 'blue');
    
    // Check each category
    const allProductIds = [];
    productCategories.forEach(category => {
      if (!category.id) {
        errors.push(`Product category missing "id"`);
      }
      if (!category.title) {
        warnings.push(`Category ${category.id} missing "title"`);
      }
      if (!category.products || !Array.isArray(category.products)) {
        errors.push(`Category ${category.id} missing or invalid "products" array`);
      } else {
        log(`    ${category.id}: ${category.products.length} products`, 'blue');
        
        // Validate each product
        category.products.forEach((product, index) => {
          if (!product.product_id) {
            errors.push(`Product at index ${index} in category ${category.id} missing "product_id"`);
          } else {
            allProductIds.push(product.product_id);
          }
          
          if (!product.public_data) {
            errors.push(`Product ${product.product_id} missing "public_data"`);
          } else {
            if (!product.public_data.name) {
              errors.push(`Product ${product.product_id} missing "name"`);
            }
            if (typeof product.public_data.price !== 'number') {
              errors.push(`Product ${product.product_id} missing or invalid "price"`);
            }
          }
          
          if (!product.system_data) {
            warnings.push(`Product ${product.product_id} missing "system_data"`);
          }
        });
      }
    });
    
    // Check for duplicate product IDs
    const duplicates = allProductIds.filter(
      (id, index) => allProductIds.indexOf(id) !== index
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate product IDs found: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    log(`  Total products: ${allProductIds.length}`, 'blue');
  }
  
  return { errors, warnings };
}

function validateProducts(data) {
  const errors = [];
  const warnings = [];
  
  if (!data.product_categories) {
    errors.push('Missing "product_categories" array');
    return { errors, warnings };
  }
  
  log(`  Found ${data.product_categories.length} product categories`, 'blue');
  
  const allProductIds = [];
  data.product_categories.forEach(category => {
    if (!category.id) {
      errors.push(`Product category missing "id"`);
    }
    if (!category.products || !Array.isArray(category.products)) {
      errors.push(`Category ${category.id} missing or invalid "products" array`);
    } else {
      log(`    ${category.id}: ${category.products.length} products`, 'blue');
      
      category.products.forEach(product => {
        if (product.product_id) {
          allProductIds.push(product.product_id);
        }
      });
    }
  });
  
  log(`  Total products: ${allProductIds.length}`, 'blue');
  
  return { errors, warnings };
}

// Main validation
log('\n🔍 Backend JSON Validation\n', 'blue');
log('═'.repeat(50), 'blue');

// Validate page_content.json
const pageContent = validateJSON('page_content.json');
if (pageContent) {
  const result = validatePageContent(pageContent);
  
  if (result.errors.length > 0) {
    log('\n❌ Errors found:', 'red');
    result.errors.forEach(error => log(`  • ${error}`, 'red'));
  }
  
  if (result.warnings.length > 0) {
    log('\n⚠️  Warnings:', 'yellow');
    result.warnings.forEach(warning => log(`  • ${warning}`, 'yellow'));
  }
  
  if (result.errors.length === 0 && result.warnings.length === 0) {
    log('\n✓ page_content.json is valid!', 'green');
  }
}

// Validate products.json
const products = validateJSON('products.json');
if (products) {
  const result = validateProducts(products);
  
  if (result.errors.length > 0) {
    log('\n❌ Errors found:', 'red');
    result.errors.forEach(error => log(`  • ${error}`, 'red'));
  }
  
  if (result.errors.length === 0) {
    log('\n✓ products.json is valid!', 'green');
  }
}

// Validate site_content.json
const siteContent = validateJSON('site_content.json');
if (siteContent) {
  log('✓ site_content.json is valid!', 'green');
}

log('\n' + '═'.repeat(50), 'blue');
log('Validation complete!\n', 'green');
