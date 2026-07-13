/**
 * Резолвер за продуктови изображения.
 *
 * B2B каталогът (fitness1.bg) блокира hotlinking с
 * Cross-Origin-Resource-Policy: same-origin + 403 — изображенията му не могат
 * да се зареждат директно от нашия сайт. Пренасочваме ги през wsrv.nl
 * (безплатен image proxy/CDN с кеш), който също оптимизира размера.
 */

const BLOCKED_IMAGE_HOSTS = ['fitness1.bg', 'www.fitness1.bg'];
const PROXY_BASE = 'https://wsrv.nl/?url=';

/**
 * Връща зареждаем URL за изображение — проксира блокирани хостове.
 * @param {string} url
 * @param {number} [width] - по избор: макс. ширина за оптимизация
 * @returns {string}
 */
export function resolveImageUrl(url, width = 800) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith(PROXY_BASE)) return raw;
  try {
    const parsed = new URL(raw, window.location.href);
    if (!BLOCKED_IMAGE_HOSTS.includes(parsed.hostname)) return raw;
    const stripped = parsed.host + parsed.pathname + parsed.search;
    return `${PROXY_BASE}${encodeURIComponent(stripped)}&w=${width}&fit=inside&q=85`;
  } catch {
    return raw;
  }
}

/**
 * Пренаписва image полетата на продукт (in place) към зареждаеми URL-и.
 * Покрива image_url, additional_images, label_url и вариантите.
 * @param {object} product - елемент от page_content категория
 */
export function rewriteProductImages(product) {
  const pd = product?.public_data;
  if (!pd) return;
  if (pd.image_url) pd.image_url = resolveImageUrl(pd.image_url);
  if (pd.label_url) pd.label_url = resolveImageUrl(pd.label_url);
  if (typeof pd.additional_images === 'string' && pd.additional_images.trim()) {
    pd.additional_images = pd.additional_images
      .split('\n')
      .map((u) => resolveImageUrl(u.trim()))
      .filter(Boolean)
      .join('\n');
  } else if (Array.isArray(pd.additional_images)) {
    pd.additional_images = pd.additional_images.map((u) => resolveImageUrl(u));
  }
  for (const v of pd.variants || []) {
    if (v.image_url) v.image_url = resolveImageUrl(v.image_url);
  }
}

/**
 * Пренаписва изображенията на всички продукти в page_content.
 * @param {Array} pageContent
 */
export function rewriteAllProductImages(pageContent) {
  for (const component of pageContent || []) {
    if (component.type === 'product_category' && Array.isArray(component.products)) {
      component.products.forEach(rewriteProductImages);
    }
  }
}
