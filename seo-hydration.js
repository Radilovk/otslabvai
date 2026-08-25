/** Remove edge-prerendered SEO blocks after client hydration. */
export function removeSeoPrerender() {
  document.getElementById('seo-catalog')?.remove();
  document.getElementById('seo-product')?.remove();
}

function slugifyClient(s = '') {
  return String(s)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve product id from /products/<slug> URLs or edge-injected meta.
 * @param {{ paramName?: string, metaName?: string }} [opts]
 */
export function resolveSeoProductId(opts = {}) {
  const paramName = opts.paramName || 'id';
  const metaName = opts.metaName || 'product-id';

  if (typeof window.__SEO_PRODUCT_ID === 'string' && window.__SEO_PRODUCT_ID) {
    return window.__SEO_PRODUCT_ID;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(paramName) || params.get('group_id');
  if (fromQuery) return fromQuery;

  const meta = document.querySelector(`meta[name="${metaName}"]`);
  if (meta?.getAttribute('content')) return meta.getAttribute('content');

  const match = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
  if (match) return decodeURIComponent(match[1]);

  return null;
}

/** Match catalog product by product_id or SEO slug. */
export function matchCatalogProduct(products, token) {
  if (!token || !Array.isArray(products)) return null;
  const direct = products.find((p) => String(p.product_id) === String(token));
  if (direct) return direct;

  const slug = String(token).toLowerCase();
  return products.find((p) => {
    const nameSlug = slugifyClient(p.public_data?.name || '');
    const idSlug = String(p.product_id || '').replace(/^prod-/, '').toLowerCase();
    return nameSlug === slug || idSlug === slug;
  }) || null;
}

/** Match portfolio index entry by group_id or SEO slug. */
export function matchPortfolioIndexEntry(index, token) {
  if (!token || !Array.isArray(index)) return null;
  const direct = index.find((e) => String(e.group_id) === String(token));
  if (direct) return direct;

  const slug = String(token).toLowerCase();
  return index.find((e) => slugifyClient(e.name) === slug) || null;
}

export { slugifyClient };
