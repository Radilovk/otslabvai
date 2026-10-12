/**
 * Промо цени в каталога. Изчисляват се САМО на сървъра (POST /portfolio/promo-prices), защото
 * зависят от доставната цена, която не бива да стига до браузъра. Клиентът пази готовите цени
 * в кеш по промо код и показва нормалната цена, докато не дойдат.
 */
import { API_URL } from './config.js';
import { setLowMarginPromoUnlock, clearLowMarginPromoUnlock } from './product-visibility.js';
import { formatGroupPriceHtml } from './portfolio-pricing.js';

export const PROMO_CHANGED_EVENT = 'pf-promo-changed';

/** Any applied promo unlocks hidden (<25% margin) catalog products. */
export function promoUnlocksLowMargin(promo) {
  return !!promo?.code;
}

export function syncPromoCatalogUnlock(promo) {
  if (promoUnlocksLowMargin(promo)) {
    setLowMarginPromoUnlock({ show_low_margin: true });
  } else {
    clearLowMarginPromoUnlock();
  }
}

export function notifyPromoChanged(promo) {
  try {
    window.dispatchEvent(new CustomEvent(PROMO_CHANGED_EVENT, { detail: { promo } }));
  } catch {
    /* non-browser */
  }
}

/** promoCode → { groups: Map<group_id, stats>, variants: Map<sku_id, price fields> } */
const promoPriceCache = new Map();

function cacheFor(promo) {
  const code = String(promo?.code || '');
  if (!promoPriceCache.has(code)) promoPriceCache.set(code, { groups: new Map(), variants: new Map() });
  return promoPriceCache.get(code);
}

/**
 * Браузър: изтегля промо цените за показваните продукти/варианти (само липсващите в кеша).
 * @returns {Promise<boolean>} true, ако са дошли нови цени (трябва повторно рендиране)
 */
export async function fetchPromoPrices(promo, { groupIds = [], skuIds = [] } = {}, fetchImpl = fetch) {
  if (!promo?.code) return false;
  const cache = cacheFor(promo);
  const missingGroups = [...new Set(groupIds.map(String))].filter((id) => id && !cache.groups.has(id)).slice(0, 200);
  const missingSkus = [...new Set(skuIds.map(String))].filter((id) => id && !cache.variants.has(id)).slice(0, 200);
  if (!missingGroups.length && !missingSkus.length) return false;
  try {
    const res = await fetchImpl(`${API_URL}/portfolio/promo-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: promo.code, group_ids: missingGroups, sku_ids: missingSkus }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    for (const id of missingGroups) cache.groups.set(id, data.groups?.[id] || null);
    for (const id of missingSkus) cache.variants.set(id, data.variants?.[id] || null);
    return true;
  } catch {
    return false;
  }
}

export function formatIndexPriceHtml(item, promo) {
  if (!promo) return formatGroupPriceHtml(item);
  const stats = cacheFor(promo).groups.get(String(item.group_id));
  return formatGroupPriceHtml(stats || item);
}

/** Браузър: вариант с промо цена от сървъра (ако вече е изтеглена). */
export function variantDisplayPrice(variant, promo) {
  if (!variant || !promo) return variant;
  const priced = cacheFor(promo).variants.get(String(variant.sku_id));
  return priced ? { ...variant, ...priced } : variant;
}
