# site_content.json - DEPRECATED

## Status: DEPRECATED - DO NOT USE

This file is **deprecated** and is no longer used in the application.

## Reason for Deprecation

The application has migrated to using `page_content.json` which contains:
- All settings from site_content.json
- Additional page content and components
- More comprehensive navigation structure
- Better organization for CMS functionality

## Migration

All functionality has been migrated to `page_content.json`:

### Old (site_content.json)
```json
{
  "settings": { ... },
  "navigation": [ ... ],
  "page_content": [ ... ],
  "footer": { ... }
}
```

### New (page_content.json)
```json
{
  "settings": { ... },      // Enhanced with more options
  "navigation": [ ... ],     // Updated navigation items
  "page_content": [ ... ],   // Comprehensive page components
  "footer": { ... }          // Same structure
}
```

## Current Usage

**site_content.json**: ❌ Not used anywhere in the codebase
**page_content.json**: ✅ Used by index.js and admin.js

## Recommendation

This file can be safely **deleted** as it serves no purpose and contains outdated data that could cause confusion.

## Data Inconsistencies Found

The site_content.json contains **outdated** data:
- site_name: "ОТСЛАБВАНЕ" (should be "ДА ОТСЛАБНА")
- Old navigation structure
- Missing modern components

This outdated data could have caused the flickering issues that were reported.

## Date of Deprecation

2025-01-28
