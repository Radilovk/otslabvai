# Additional Images Upload Feature

## Overview
This feature adds the ability to upload multiple additional images for products in the admin panel, not just a single main image.

## Problem Statement
Previously, the admin panel allowed:
- ✅ Uploading a single main image via the "Upload" button
- ✅ Manually entering URLs for additional images in a textarea
- ❌ **Missing**: Upload button for additional images

## Solution
Added an "Upload" button next to the additional images textarea that:
- Allows selecting **multiple images** at once
- Uploads all selected images to GitHub in parallel
- Automatically appends the uploaded URLs to the existing list
- Maintains the newline-separated format expected by the product page

## Changes Made

### 1. admin.html
**Location**: Line 881-890

- Added a wrapper `<div>` with flexbox layout around the textarea
- Added an "Upload" button with:
  - `data-action="upload-additional-images"`
  - `data-target-field="public_data.additional_images"`
- Updated help text to mention multi-select capability
- Added a new hidden file input with `multiple` attribute:
  ```html
  <input type="file" id="image-upload-input-multiple" accept="image/*" multiple style="display: none;">
  ```

### 2. admin.js
**Location**: Line 1294-1351

Added new case handler `'upload-additional-images'` that:
1. **Validates** all selected files (type and size)
2. **Uploads** all images in parallel using `Promise.all()`
3. **Appends** new URLs to existing ones in the textarea
4. **Formats** URLs as newline-separated strings
5. **Shows** progress indication during upload

## Technical Details

### File Validation
- **File type**: Only images (`image/*`)
- **File size**: Maximum 2MB per file
- **Error handling**: Shows user-friendly messages for validation errors

### Upload Process
```javascript
// Convert FileList to Array
const files = Array.from(e.target.files);

// Upload all files in parallel
const uploadPromises = files.map(file => uploadImageToGitHub(file));
const imageUrls = await Promise.all(uploadPromises);

// Append to existing URLs
const existingUrls = textareaElement.value.split('\n').map(url => url.trim()).filter(url => url);
const allUrls = [...existingUrls, ...imageUrls];
textareaElement.value = allUrls.join('\n');
```

### Format Compatibility
The uploaded URLs are stored as newline-separated strings, which is fully compatible with the existing `product.js` code:

```javascript
// From product.js (line 226-228)
if (typeof publicData.additional_images === 'string') {
    additionalImages = publicData.additional_images.split('\n').map(url => url.trim()).filter(url => url);
}
```

## User Experience

### Before
1. Admin manually uploads images to GitHub
2. Admin copies URLs manually
3. Admin pastes URLs into textarea (one per line)

### After
1. Admin clicks "Upload" button
2. Admin selects multiple images from their computer
3. System automatically uploads and adds URLs to textarea
4. Admin can repeat to add more images

### UI Changes
- Upload button appears next to the textarea (not below)
- Button shows progress: "⏳ Качване 3 изображение/я..."
- Success message: "3 изображение/я качени успешно!"

## Testing

### Manual Testing Checklist
- [ ] Open admin.html in browser
- [ ] Edit a product
- [ ] Click "Upload" button next to "Допълнителни изображения"
- [ ] Select multiple image files (e.g., 3 images)
- [ ] Verify upload progress is shown
- [ ] Verify success message appears
- [ ] Verify URLs are added to textarea (one per line)
- [ ] Verify existing URLs are preserved when uploading more
- [ ] Test validation: try uploading non-image file
- [ ] Test validation: try uploading file > 2MB
- [ ] Save product and verify images appear on product page

### Validation Tests
```javascript
// Test 1: Non-image file should be rejected
// Expected: "Моля изберете само изображения"

// Test 2: File > 2MB should be rejected
// Expected: "Изображението "large.jpg" е твърде голямо. Максимален размер: 2MB"

// Test 3: Multiple valid images should upload
// Expected: All URLs added to textarea, newline-separated
```

## Security Considerations
- ✅ Uses existing `uploadImageToGitHub()` function (already secure)
- ✅ Requires GitHub Personal Access Token
- ✅ Token stored in sessionStorage (cleared on browser close)
- ✅ File size validation prevents large uploads
- ✅ File type validation prevents non-image uploads

## Future Enhancements
- Add image preview before upload
- Add ability to reorder images (drag and drop)
- Add ability to delete individual images
- Show upload progress percentage
- Compress images before upload

## Related Files
- `admin.html` - Admin panel HTML
- `admin.js` - Admin panel JavaScript
- `product.js` - Product page that displays the images
- `backend/page_content.json` - Product data structure

## Notes
- This feature uses the same upload mechanism as the main image
- GitHub token is required for uploads (same as main image)
- Images are uploaded to `images/products/` directory
- Generated filenames: `product-{timestamp}-{sanitizedName}`
