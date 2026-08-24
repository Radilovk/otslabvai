/**
 * Cart line UI helpers — product links from checkout with return-to-cart navigation.
 */

export const CHECKOUT_RETURN_PARAM = 'from_checkout';

/** Append return path so product page back button can restore checkout. */
export function withCheckoutReturn(url, returnPath) {
  if (!url || !returnPath) return url;
  try {
    const base = typeof location !== 'undefined' ? location.origin : 'https://example.com';
    const u = new URL(url, base);
    u.searchParams.set(CHECKOUT_RETURN_PARAM, returnPath.replace(/^\//, ''));
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

/** Read checkout return path from current URL or explicit search string. */
export function getCheckoutReturnPath(search = typeof location !== 'undefined' ? location.search : '') {
  const raw = new URLSearchParams(search).get(CHECKOUT_RETURN_PARAM)?.trim();
  return raw || null;
}

/** Product detail URL for a life-protocols cart line (site + portfolio SKUs). */
export function resolveLifeCartProductUrl(item) {
  const rawId = String(item?.product_id || item?.id || item?.sku_id || '').trim();
  if (!rawId) return null;

  const pfMatch = rawId.match(/^prod-pf-(\d+)(?:_(.+))?$/);
  if (pfMatch) {
    let url = `portfolio-product.html?group_id=${encodeURIComponent(pfMatch[1])}`;
    if (pfMatch[2]) url += `&sku=${encodeURIComponent(pfMatch[2])}`;
    return url;
  }

  const baseId = rawId.split('_')[0];
  if (!baseId) return null;
  return `life-product.html?id=${encodeURIComponent(baseId)}`;
}

/** Product detail URL for main daotslabna.com cart line. */
export function resolveMainCartProductUrl(item) {
  const rawId = String(item?.product_id || item?.id || item?.sku_id || '').trim();
  if (!rawId) return null;

  const pfMatch = rawId.match(/^prod-pf-(\d+)(?:_(.+))?$/);
  if (pfMatch) {
    let url = `portfolio-product.html?group_id=${encodeURIComponent(pfMatch[1])}`;
    if (pfMatch[2]) url += `&sku=${encodeURIComponent(pfMatch[2])}`;
    return url;
  }

  const baseId = rawId.split('_')[0];
  return `product.html?id=${encodeURIComponent(baseId)}`;
}

/**
 * @param {object} item
 * @param {string|null} productUrl
 * @param {function} escapeHtml
 * @param {{ thumb?: string, link?: string, empty?: string }} [classes]
 */
export function renderCheckoutCartItemMedia(item, productUrl, escapeHtml, classes = {}) {
  const thumbClass = classes.thumb || 'pf-summary-img';
  const linkClass = classes.link || 'pf-summary-product-link pf-summary-thumb-link';
  const emptyClass = classes.empty || 'pf-summary-img--empty';
  const safeName = escapeHtml(item?.name || 'Продукт');
  const inner = item?.image
    ? `<img src="${escapeHtml(item.image)}" alt="" class="${thumbClass}" loading="lazy" decoding="async">`
    : `<div class="${thumbClass} ${emptyClass}" aria-hidden="true"></div>`;

  if (!productUrl) return inner;

  return `<a href="${escapeHtml(productUrl)}" class="${linkClass}" aria-label="Преглед: ${safeName}">${inner}</a>`;
}

/**
 * @param {object} item
 * @param {string|null} productUrl
 * @param {function} escapeHtml
 */
export function renderCheckoutCartItemTitle(item, productUrl, escapeHtml) {
  const safeName = escapeHtml(item?.name || 'Продукт');
  if (!productUrl) return `<strong>${safeName}</strong>`;
  return `<a href="${escapeHtml(productUrl)}" class="pf-summary-product-link pf-summary-product-name">${safeName}</a>`;
}
