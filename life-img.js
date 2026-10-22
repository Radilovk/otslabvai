/**
 * Резолвер за продуктови изображения.
 *
 * B2B каталогът (fitness1.bg) блокира hotlinking с
 * Cross-Origin-Resource-Policy: same-origin + 403 — изображенията му не могат
 * да се зареждат директно от нашия сайт. Пренасочваме ги през wsrv.nl
 * (безплатен image proxy/CDN с кеш), който също оптимизира размера.
 */

const PROXY_BASE = 'https://wsrv.nl/?url=';
// Собствените файлове от GitHub (админът пази такива URL-и) се сервират от сайта.
const OWN_RAW_PREFIX = 'https://raw.githubusercontent.com/Radilovk/otslabvai/main/';
// Малките иконки и логото имат готови .webp копия до .png файла.
const LOCAL_WEBP = /^images\/life-icons\/[a-z0-9-]+\.png$/;

/** Ширина за продуктовите карти (≈ 2.5× от ширината на картата на телефон). */
export const CARD_IMAGE_WIDTH = 480;

/**
 * Собствен файл от репото → относителен път на сайта (същият домейн, кеш на CDN).
 * @param {string} url
 * @returns {string}
 */
export function localizeOwnAsset(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith(OWN_RAW_PREFIX)) return raw;
  const path = decodeURI(raw.slice(OWN_RAW_PREFIX.length));
  return LOCAL_WEBP.test(path) ? path.replace(/\.png$/, '.webp') : path;
}

/**
 * Връща лек, зареждаем URL за изображение. Външните снимки (вкл. fitness1.bg,
 * който блокира hotlinking) минават през wsrv.nl: смалени до `width`, в WebP и
 * с кеш на CDN — продуктовите снимки на доставчиците са 1000×1000 JPEG.
 * Малките собствени иконки се връщат локално.
 * @param {string} url
 * @param {number} [width] - макс. ширина
 * @returns {string}
 */
export function resolveImageUrl(url, width = 800) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith(PROXY_BASE)) return raw;
  const local = localizeOwnAsset(raw);
  if (local !== raw && /\.webp$/.test(local) && LOCAL_WEBP.test(local.replace(/\.webp$/, '.png'))) return local;
  try {
    const parsed = new URL(raw, window.location.href);
    if (!/^https?:$/.test(parsed.protocol)) return raw;
    if (parsed.origin === window.location.origin) return raw;
    if (/\.svg$/i.test(parsed.pathname)) return raw;
    const stripped = parsed.host + parsed.pathname + parsed.search;
    return `${PROXY_BASE}${encodeURIComponent(stripped)}&w=${width}&fit=inside&q=80&output=webp`;
  } catch {
    return raw;
  }
}

/**
 * Пренаписва image полетата на продукт (in place) към зареждаеми URL-и.
 * Покрива image_url, additional_images, label_url и вариантите.
 * @param {object} product - елемент от page_content категория
 * @param {number} [width] - ширина на главната снимка (карти: CARD_IMAGE_WIDTH)
 */
export function rewriteProductImages(product, width = 800) {
  const pd = product?.public_data;
  if (!pd) return;
  if (pd.image_url) pd.image_url = resolveImageUrl(pd.image_url, width);
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
      component.products.forEach((p) => rewriteProductImages(p, CARD_IMAGE_WIDTH));
    }
  }
}
