/**
 * Direct-sale products (Lida, MeiziMax, Eveslim) — manual fulfillment, no B2B submit.
 */

export const DIRECT_SALE_PRODUCT_IDS = new Set([
  'prod-lida-green',
  'prod-meizimax',
  'prod-eveslim-birch',
  'prod-eveslim-cayenne',
]);

const DIRECT_SALE_KEYWORDS = ['lida', 'лида', 'meizimax', 'мейзимакс', 'eveslim', 'евеслим'];

export function normalizeOrderSkuId(raw) {
  return String(raw?.sku_id || raw?.id || '').trim().toLowerCase();
}

export function resolveDirectSaleProductId(raw) {
  const sku = normalizeOrderSkuId(raw);
  if (!sku) return null;
  const base = sku.split('_')[0];
  if (DIRECT_SALE_PRODUCT_IDS.has(base)) return base;
  if (DIRECT_SALE_PRODUCT_IDS.has(sku)) return sku;
  return null;
}

/** @returns {boolean} */
export function isDirectSaleProductLine(product) {
  if (resolveDirectSaleProductId(product)) return true;
  const name = String(product?.name || '').toLowerCase();
  return DIRECT_SALE_KEYWORDS.some((kw) => name.includes(kw));
}

/** @returns {{ direct: object[], b2b: object[] }} */
export function splitOrderProducts(products) {
  const direct = [];
  const b2b = [];
  for (const p of products || []) {
    if (isDirectSaleProductLine(p)) direct.push(p);
    else b2b.push(p);
  }
  return { direct, b2b };
}

export function getDirectSaleProducts(order) {
  return splitOrderProducts(order?.products).direct;
}

export function getB2bProducts(order) {
  return splitOrderProducts(order?.products).b2b;
}

export function orderHasDirectSaleProducts(order) {
  return getDirectSaleProducts(order).length > 0;
}

export function orderHasB2bProducts(order) {
  return getB2bProducts(order).length > 0;
}

export function orderIsDirectSaleOnly(order) {
  const { direct, b2b } = splitOrderProducts(order?.products);
  return direct.length > 0 && b2b.length === 0;
}
