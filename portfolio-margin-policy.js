/**
 * Catalog margin rule for Fitness1 + Sila.bg (and all 3 storefronts).
 * Uses resolved retail_price vs b2b_price after portfolio-pricing.js.
 * Margin % = (retail − b2b) / retail × 100 ≥ 25%.
 * Computed once at sync/import → margin_eligible; listings check the flag.
 */

export const MIN_CATALOG_MARGIN_PCT = 25;

export function variantMarginPct(variant) {
  const b2b = Number(variant?.b2b_price) || 0;
  const retail = Number(variant?.retail_price) || 0;
  if (!(b2b > 0 && retail > b2b)) return 0;
  return ((retail - b2b) / retail) * 100;
}

/**
 * По-скъпи сме от магазина на самия доставчик (Fitness1 sale/regular, промоция в магазина на Sila):
 * клиентът ще го намери по-евтино там — не предлагаме такъв вариант.
 */
export function variantIsUndercutByDistributorShop(variant) {
  const reference = Number(variant?.f1_reference_price) || 0;
  const retail = Number(variant?.retail_price) || 0;
  return reference > 0 && retail > reference + 0.005;
}

export function variantHasMargin(variant, minPct = MIN_CATALOG_MARGIN_PCT) {
  return variantMarginPct(variant) >= minPct && !variantIsUndercutByDistributorShop(variant);
}

export function groupHasMargin(group, minPct = MIN_CATALOG_MARGIN_PCT) {
  return (group?.variants || []).some(
    (v) => v.available !== false && variantHasMargin(v, minPct)
  );
}

/** Index entry or site product — hidden only when margin_eligible is explicitly false. */
export function isCatalogListed(item, allowLowMargin = false) {
  if (allowLowMargin) return true;
  const flag = item?.margin_eligible ?? item?.system_data?.margin_eligible;
  return flag !== false;
}
