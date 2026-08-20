/**
 * Promo-aware catalog: unlock low-margin listings + display adjusted prices.
 */
import { setLowMarginPromoUnlock, clearLowMarginPromoUnlock } from './product-visibility.js';
import { promoUsesLinePricing } from './portfolio-checkout-shared.js';
import {
  resolvePromoLinePrice,
  summarizeGroupPricing,
  formatGroupPriceHtml,
  ceilRetailPrice,
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

function applyCartPercentToVariants(variants, promo) {
  const pct = Number(promo?.discount) || 0;
  if (!(pct > 0) || promo?.discountType !== 'percentage' || promoUsesLinePricing(promo)) {
    return variants;
  }
  const factor = 1 - pct / 100;
  return variants.map((v) => {
    const retail = Number(v.retail_price) || 0;
    const next = ceilRetailPrice(retail * factor);
    return {
      ...v,
      retail_price: next,
      compare_at_price: retail,
      is_on_promo: true,
    };
  });
}

function variantsWithPromoPrices(variants, promo) {
  const available = (variants || []).filter((v) => v.available !== false && (Number(v.retail_price) || 0) > 0);
  if (!promo) return available;

  if (promoUsesLinePricing(promo)) {
    return available.map((v) => {
      const catalogRetail = Number(v.retail_price) || 0;
      const promoRetail = resolvePromoLinePrice(v, promo);
      if (promoRetail === catalogRetail) return v;
      return {
        ...v,
        retail_price: promoRetail,
        compare_at_price: catalogRetail,
        is_on_promo: true,
      };
    });
  }

  return applyCartPercentToVariants(available, promo);
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
    const factor = 1 - Number(promo.discount) / 100;
    const min = ceilRetailPrice((Number(item.min_price) || 0) * factor);
    const max = ceilRetailPrice((Number(item.max_price) || 0) * factor);
    return formatGroupPriceHtml({
      min_price: min,
      max_price: max,
      compare_at_price: Number(item.min_price) || 0,
      has_promo: min < (Number(item.min_price) || 0),
    });
  }

  return formatGroupPriceHtml(item);
}

/** Line-pricing promos need per-variant b2b data; cart % uses index min/max only. */
export async function enrichCatalogItemsWithPromoPrices(items, promo) {
  if (!promo || !items?.length || !promoUsesLinePricing(promo)) return items || [];
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
