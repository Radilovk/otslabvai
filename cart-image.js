/**
 * Cart line image resolution for main / life / portfolio checkouts.
 * Handles manual products, Fitness1/Sila imports, and API-added lines.
 */
import { resolveImageUrl } from './life-img.js';
import { findSiteProduct, siteProductToOrderLine } from './portfolio-site-products.js';

/** Raw image field from any cart source (manual, advisor, import, API). */
export function pickCartImageRaw(item) {
  if (!item || typeof item !== 'object') return '';
  return String(
    item.image
    || item.image_url
    || item.thumbnail
    || item.thumb
    || ''
  ).trim();
}

/** Browser-safe image URL for cart thumbnails (proxies blocked Fitness1 hosts). */
export function resolveCartImageUrl(item, width = 120) {
  return resolveImageUrl(pickCartImageRaw(item), width);
}

/**
 * Fill missing cart images from site page_content (manual + legacy site products).
 * @returns {boolean} true if any item was updated
 */
export function enrichCartImagesFromPageContent(cart, pageContent) {
  if (!Array.isArray(cart) || !pageContent?.page_content) return false;
  let changed = false;
  for (const item of cart) {
    if (pickCartImageRaw(item)) continue;
    const found = findSiteProduct(pageContent, item.id || item.sku_id);
    if (!found) continue;
    const line = siteProductToOrderLine(found.product, found.variantSku, 1);
    const src = String(line?.image || '').trim();
    if (!src) continue;
    item.image = src;
    changed = true;
  }
  return changed;
}

/**
 * Apply server validate-cart lines onto local cart (price + image when missing).
 * @returns {boolean}
 */
export function syncCartFromServer(cart, serverProducts) {
  if (!Array.isArray(cart) || !Array.isArray(serverProducts)) return false;
  let changed = false;
  for (const item of serverProducts) {
    const sku = String(item.sku_id || '');
    const idx = cart.findIndex((c) => {
      const local = String(c.sku_id || c.id || '');
      return local === sku || local.endsWith(`_${sku}`) || sku.endsWith(`_${local}`);
    });
    if (idx < 0) continue;
    if (item.retail_price != null && cart[idx].price !== item.retail_price) {
      cart[idx].price = item.retail_price;
      changed = true;
    }
    const serverImg = pickCartImageRaw(item);
    if (serverImg && !pickCartImageRaw(cart[idx])) {
      cart[idx].image = serverImg;
      changed = true;
    }
  }
  return changed;
}

/** @deprecated use syncCartFromServer */
export function syncCartPricesFromServer(cart, serverProducts) {
  return syncCartFromServer(cart, serverProducts);
}
