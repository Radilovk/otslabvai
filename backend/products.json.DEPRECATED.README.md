# THIS FILE IS DEPRECATED

**DO NOT USE THIS FILE**

This file has been deprecated as part of the architectural fix to eliminate duplicate product data.

## Why Deprecated?
- Created confusion by having products in TWO places
- Was NOT used by the frontend application
- Contained only 4 products vs 12 in page_content.json
- Caused maintenance and synchronization issues

## Use Instead
**ONLY edit: `backend/page_content.json`**

This is the SINGLE source of truth for:
- All products
- Site navigation
- Footer content
- Site settings

## History
- Deprecated on: 2026-01-23
- Reason: Architectural simplification
- See: ARCHITECTURE_FIX.md for details
