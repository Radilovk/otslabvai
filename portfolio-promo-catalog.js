/**
 * Promo-aware catalog — instant client-side updates after validate-promo.
 * Uses index vp dots + min_client_price (built at sync); no chunk fetches.
 */
import { setLowMarginPromoUnlock, clearLowMarginPromoUnlock } from './product-visibility.js';
import { promoUsesLinePricing } from './portfolio-checkout-shared.js';
import {
  computePromoStatsFromVp,
  formatGroupPriceHtml,
  ceilRetailPrice,
  variantFromPricingDot,
  resolvePromoLinePrice,
  applyCartPercentPromoPrice,
  promoCompareAtPrice,
} from './portfolio-pricing.js';

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

function cartPercentIndexStats(item, promo) {
  const clientMin = Number(item.min_client_price ?? item.min_price) || 0;
  const clientMax = Number(item.max_client_price ?? item.max_price) || clientMin;
  const sellingMin = Number(item.min_price) || 0;
  const sellingMax = Number(item.max_price) || sellingMin;
  const pct = Number(promo.discount) / 100;
  const fromClientMin = ceilRetailPrice(clientMin * (1 - pct));
  const fromClientMax = ceilRetailPrice(clientMax * (1 - pct));
  return {
    min_price: Math.min(sellingMin, fromClientMin),
    max_price: Math.min(sellingMax, fromClientMax),
    compare_at_price: clientMin,
    has_promo: Math.min(sellingMin, fromClientMin) < clientMin,
  };
}

export function formatIndexPriceHtml(item, promo) {
  if (!promo) return formatGroupPriceHtml(item);

  if (item.vp?.length) {
    const stats = computePromoStatsFromVp(item.vp, promo);
    if (stats) {
      return formatGroupPriceHtml({
        min_price: stats.min_price,
        max_price: stats.max_price,
        compare_at_price: stats.compare_at_price,
        has_promo: stats.has_promo || stats.compare_at_price > stats.min_price,
      });
    }
  }

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    return formatGroupPriceHtml(cartPercentIndexStats(item, promo));
  }

  return formatGroupPriceHtml(item);
}

export function variantDisplayPrice(variant, promo) {
  if (!variant || !promo) return variant;

  if (promoUsesLinePricing(promo)) {
    const selling = Number(variant.retail_price) || 0;
    const promoRetail = resolvePromoLinePrice(variant, promo);
    if (promoRetail === selling) return variant;
    return {
      ...variant,
      retail_price: promoRetail,
      compare_at_price: promoCompareAtPrice(variant, promoRetail),
      is_on_promo: true,
    };
  }

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    const { price, compareAt, isOnPromo } = applyCartPercentPromoPrice(variant, promo);
    if (!isOnPromo) return variant;
    return {
      ...variant,
      retail_price: price,
      compare_at_price: compareAt,
      is_on_promo: true,
    };
  }

  return variant;
}

/** @deprecated sync-only — kept for tests */
export function enrichCatalogItemsWithPromoPrices(items, promo) {
  if (!promo || !items?.length) return items || [];
  return items.map((item) => {
    if (!item.vp?.length) return item;
    const stats = computePromoStatsFromVp(item.vp, promo);
    if (!stats) return item;
    return {
      ...item,
      promo_min_price: stats.min_price,
      promo_max_price: stats.max_price,
      promo_compare_at_price: stats.compare_at_price,
      promo_has_adjusted_price: stats.has_promo || stats.compare_at_price > stats.min_price,
    };
  });
}

/** @deprecated sync-only — vp dots include client prices */
export function enrichIndexClientPrices(items) {
  return items || [];
}

/** @deprecated */
export async function computeGroupPromoPriceStats(groupId, promo) {
  void groupId;
  void promo;
  return null;
}

export { variantFromPricingDot };
