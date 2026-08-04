/**
 * Shared checkout helpers: server cart validation + stock warning banner.
 */

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

/**
 * Map server validate-cart lines back onto local cart items by sku/id.
 */
export function syncCartPricesFromServer(cart, serverProducts) {
  if (!Array.isArray(cart) || !Array.isArray(serverProducts)) return false;
  let changed = false;
  for (const item of serverProducts) {
    const sku = String(item.sku_id || '');
    const idx = cart.findIndex((c) => {
      const local = String(c.sku_id || c.id || '');
      return local === sku || local.endsWith(`_${sku}`) || sku.endsWith(`_${local}`);
    });
    if (idx >= 0 && item.retail_price != null && cart[idx].price !== item.retail_price) {
      cart[idx].price = item.retail_price;
      changed = true;
    }
  }
  return changed;
}
