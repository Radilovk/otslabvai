/**
 * Промо цени със скритата доставна цена — изпълнява се само на сървъра (POST /portfolio/promo-prices).
 * Чист модул без браузърни зависимости.
 */
import {
  computePromoStatsFromVp,
  ceilRetailPrice,
  resolvePromoLinePrice,
  applyCartPercentPromoPrice,
  promoCompareAtPrice,
  promoDisplayStats,
  shouldDisplayPromoPrice,
  promoUsesLinePricing,
} from './portfolio-pricing.js';

function cartPercentIndexStats(item, promo) {
  const clientMin = Number(item.min_client_price ?? item.min_price) || 0;
  const clientMax = Number(item.max_client_price ?? item.max_price) || clientMin;
  const sellingMin = Number(item.min_price) || 0;
  const sellingMax = Number(item.max_price) || sellingMin;
  const pct = Number(promo.discount) / 100;
  const fromClientMin = ceilRetailPrice(clientMin * (1 - pct));
  const fromClientMax = ceilRetailPrice(clientMax * (1 - pct));
  return promoDisplayStats({
    min_price: Math.min(sellingMin, fromClientMin),
    max_price: Math.min(sellingMax, fromClientMax),
    compare_at_price: clientMin,
    has_promo: Math.min(sellingMin, fromClientMin) < clientMin,
  });
}

/** Сървър: промо статистика за карта в каталога (vp с доставна цена — само вътрешният индекс). */
export function promoIndexStats(item, promo) {
  if (!promo) return null;
  if (item.vp?.length) {
    const stats = computePromoStatsFromVp(item.vp, promo);
    if (stats) return stats;
  }
  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    return cartPercentIndexStats(item, promo);
  }
  return null;
}

/** Сървър: промо цена на вариант с пълните данни (вкл. доставна цена). */
export function promoVariantPrice(variant, promo, policy = undefined) {
  if (!variant || !promo) return variant;

  if (promoUsesLinePricing(promo)) {
    const selling = Number(variant.retail_price) || 0;
    const promoRetail = resolvePromoLinePrice(variant, promo, policy);
    if (promoRetail === selling) return variant;
    const compareAt = promoCompareAtPrice(variant, promoRetail);
    if (!shouldDisplayPromoPrice(compareAt, promoRetail)) {
      return { ...variant, retail_price: promoRetail, compare_at_price: 0, is_on_promo: false };
    }
    return {
      ...variant,
      retail_price: promoRetail,
      compare_at_price: compareAt,
      is_on_promo: true,
    };
  }

  if (promo.discountType === 'percentage' && Number(promo.discount) > 0) {
    const { price, compareAt, isOnPromo } = applyCartPercentPromoPrice(variant, promo);
    if (!isOnPromo || !shouldDisplayPromoPrice(compareAt, price)) {
      return { ...variant, retail_price: price, compare_at_price: 0, is_on_promo: false };
    }
    return {
      ...variant,
      retail_price: price,
      compare_at_price: compareAt,
      is_on_promo: true,
    };
  }

  return variant;
}

