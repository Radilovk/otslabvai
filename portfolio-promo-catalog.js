/**
 * Promo-aware catalog: unlock low-margin listings + display adjusted prices.
 * Pricing: delivery = b2b_price, client/final = regular_price (discount % from client).
 */
import { setLowMarginPromoUnlock, clearLowMarginPromoUnlock } from './product-visibility.js';
import { promoUsesLinePricing } from './portfolio-checkout-shared.js';
import {
  resolvePromoLinePrice,
  summarizeGroupPricing,
  formatGroupPriceHtml,
  applyCartPercentPromoPrice,
  promoCompareAtPrice,
  clientFinalPrice,
  catalogSellingPrice,
} from './portfolio-pricing.js';
import { getProductFromCache } from './portfolio-cache.js';

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

function variantsWithPromoPrices(variants, promo) {
  const available = (variants || []).filter((v) => v.available !== false && catalogSellingPrice(v) > 0);
  if (!promo) return available;

  if (promoUsesLinePricing(promo)) {
    return available.map((v) => {
      const selling = catalogSellingPrice(v);
      const promoRetail = resolvePromoLinePrice(v, promo);
      if (promoRetail === selling) return v;
      return {
        ...v,
        retail_price: promoRetail,
        compare_at_price: promoCompareAtPrice(v, promoRetail),
        is_on_promo: true,
      };
    });
  }

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    return available.map((v) => {
      const { price, compareAt, isOnPromo } = applyCartPercentPromoPrice(v, promo);
      if (!isOnPromo) return v;
      return {
        ...v,
        retail_price: price,
        compare_at_price: compareAt,
        is_on_promo: true,
      };
    });
  }

  return available;
}

/** @param {string} groupId */
export async function computeGroupPromoPriceStats(groupId, promo) {
  if (!promo) return null;
  const group = await getProductFromCache(groupId);
  if (!group?.variants?.length) return null;
  const adjusted = variantsWithPromoPrices(group.variants, promo);
  if (!adjusted.length) return null;
  return summarizeGroupPricing(adjusted);
}

export function formatIndexPriceHtml(item, promo) {
  if (!promo) return formatGroupPriceHtml(item);

  if (promoUsesLinePricing(promo)) {
    return formatGroupPriceHtml({
      min_price: item.promo_min_price ?? item.min_price,
      max_price: item.promo_max_price ?? item.max_price,
      compare_at_price: item.promo_compare_at_price ?? item.compare_at_price,
      has_promo: item.promo_has_adjusted_price ?? item.has_promo,
    });
  }

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    const clientMin = Number(item.min_client_price ?? item.min_price) || 0;
    const clientMax = Number(item.max_client_price ?? item.max_price) || clientMin;
    const sellingMin = Number(item.min_price) || 0;
    const pct = Number(promo.discount) / 100;
    const fromClientMin = Math.ceil(clientMin * (1 - pct) * 10) / 10;
    const fromClientMax = Math.ceil(clientMax * (1 - pct) * 10) / 10;
    const min = Math.min(sellingMin, fromClientMin);
    const max = Math.min(Number(item.max_price) || sellingMin, fromClientMax);
    return formatGroupPriceHtml({
      min_price: min,
      max_price: max,
      compare_at_price: clientMin,
      has_promo: min < clientMin,
    });
  }

  return formatGroupPriceHtml(item);
}

/** Line-pricing promos need per-variant data; cart % uses index min when client prices absent. */
export async function enrichCatalogItemsWithPromoPrices(items, promo) {
  if (!promo || !items?.length) return items || [];
  if (!promoUsesLinePricing(promo)) return items;

  return Promise.all(items.map(async (item) => {
    const stats = await computeGroupPromoPriceStats(item.group_id, promo);
    if (!stats) return item;
    return {
      ...item,
      promo_min_price: stats.min_price,
      promo_max_price: stats.max_price,
      promo_compare_at_price: stats.compare_at_price,
      promo_has_adjusted_price: stats.has_promo || stats.compare_at_price > stats.min_price,
    };
  }));
}

export function variantDisplayPrice(variant, promo) {
  if (!variant || !promo) return variant;
  const [adjusted] = variantsWithPromoPrices([variant], promo);
  return adjusted || variant;
}

/** Attach min/max client (regular) prices for cart-% catalog cards. */
export async function enrichIndexClientPrices(items) {
  if (!items?.length) return items;
  return Promise.all(items.map(async (item) => {
    if (item.min_client_price != null) return item;
    const group = await getProductFromCache(item.group_id);
    if (!group?.variants?.length) return item;
    const available = group.variants.filter((v) => v.available !== false && catalogSellingPrice(v) > 0);
    if (!available.length) return item;
    const clientPrices = available.map((v) => clientFinalPrice(v));
    return {
      ...item,
      min_client_price: Math.min(...clientPrices),
      max_client_price: Math.max(...clientPrices),
    };
  }));
}
