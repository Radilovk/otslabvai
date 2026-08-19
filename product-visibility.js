import { isCatalogListed } from './portfolio-margin-policy.js';

/** Per-category flag on product in category.products[] — undefined = on homepage (back compat). */
export const isOnHomepage = (p) => p?.system_data?.show_on_homepage !== false;
export const isCatalogOnly = (p) => p?.system_data?.show_on_homepage === false;

const LOW_MARGIN_PROMO_KEY = 'pfPromoShowLowMargin';

export function isLowMarginPromoUnlocked() {
  try {
    return sessionStorage.getItem(LOW_MARGIN_PROMO_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {{ show_low_margin?: boolean } | null} promo */
export function setLowMarginPromoUnlock(promo) {
  try {
    if (promo?.show_low_margin) {
      sessionStorage.setItem(LOW_MARGIN_PROMO_KEY, '1');
    } else {
      sessionStorage.removeItem(LOW_MARGIN_PROMO_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearLowMarginPromoUnlock() {
  setLowMarginPromoUnlock(null);
}

export function isProductListed(product) {
  const inv = Number(product?.system_data?.inventory ?? 0);
  if (inv <= 0) return false;
  return isCatalogListed(product, isLowMarginPromoUnlocked());
}

export function findCategory(pageContent, categoryId = '', componentId = '') {
  const cats = (pageContent || []).filter((c) => c.type === 'product_category' && !c.is_hidden);
  if (componentId) {
    const hit = cats.find((c) => c.component_id === componentId);
    if (hit) return hit;
  }
  if (categoryId) {
    return cats.find((c) => c.id === categoryId || c.category_id === categoryId) || null;
  }
  return null;
}

export function catalogLink(page, component, slug) {
  const p = new URLSearchParams();
  const id = slug || component?.id || component?.category_id;
  if (id) p.set('category', id);
  if (component?.component_id) p.set('component', component.component_id);
  const qs = p.toString();
  return qs ? `${page}?${qs}` : page;
}

export function sortByOrder(products) {
  return (products || []).slice().sort((a, b) => (a.display_order ?? 999999) - (b.display_order ?? 999999));
}
