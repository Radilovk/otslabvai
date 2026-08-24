/**
 * Shared checkout helpers: server cart validation + stock warning banner.
 */
import { syncCartFromServer, syncCartPricesFromServer } from './cart-image.js';

export { syncCartFromServer, syncCartPricesFromServer };

const STOCK_BANNER_ID = 'cart-stock-warning';

export function ensureStockWarningBanner(listId = 'product-list') {
  let banner = document.getElementById(STOCK_BANNER_ID);
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = STOCK_BANNER_ID;
  banner.className = 'pf-stock-warning';
  banner.setAttribute('role', 'alert');
  banner.hidden = true;
  const list = document.getElementById(listId);
  list?.parentNode?.insertBefore(banner, list);
  return banner;
}

export function setStockWarningBanner(text, listId = 'product-list') {
  const banner = ensureStockWarningBanner(listId);
  if (!text) {
    banner.hidden = true;
    banner.textContent = '';
    return '';
  }
  banner.hidden = false;
  banner.textContent = text;
  return text;
}

/**
 * POST /portfolio/validate-cart and optionally refresh local cart prices.
 * @param {object} opts
 * @param {string} opts.apiUrl
 * @param {Array} opts.products
 * @param {string} [opts.promoCode]
 * @param {string} [opts.project]
 * @param {boolean} [opts.silent]
 * @param {function} [opts.showToast]
 * @param {function} [opts.onPriceSync] - (serverProducts) => void
 * @returns {Promise<boolean>}
 */
export async function validateCartOnServer({
  apiUrl,
  products,
  promoCode,
  project,
  silent = false,
  showToast,
  onPriceSync
} = {}) {
  if (!Array.isArray(products) || !products.length) {
    setStockWarningBanner('');
    return true;
  }

  try {
    const res = await fetch(`${apiUrl}/portfolio/validate-cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products,
        promoCode: promoCode || undefined,
        project: project || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || 'Някои продукти вече не са налични.';
      setStockWarningBanner(msg);
      if (!silent && showToast) showToast(msg, 'error');
      return false;
    }

    if (Array.isArray(data.products) && onPriceSync) {
      onPriceSync(data.products);
    }

    setStockWarningBanner('');
    return true;
  } catch {
    const msg = 'Неуспешна проверка на наличност. Опитайте отново.';
    setStockWarningBanner(msg);
    if (!silent && showToast) showToast(msg, 'error');
    return false;
  }
}

/** True when promo adjusts per-line prices (not a cart-level discount). */
export function promoUsesLinePricing(promo) {
  if (!promo) return false;
  if (promo.pricing_mode && promo.pricing_mode !== 'none') return true;
  return promo.discountType === 'margin_percentage';
}
