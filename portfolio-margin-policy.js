/**
 * Minimum catalog margin: profit between our retail price and B2B cost.
 * Margin % = (retail − b2b) / retail × 100 (крайна намалена цена vs доставна).
 * Products below threshold are hidden from listings and AI unless a promo unlocks them.
 */

export const MIN_CATALOG_MARGIN_PCT = 25;

/** @param {{ b2b_price?: number, retail_price?: number }} variant */
export function variantMarginOnRetailPct(variant) {
  const b2b = Number(variant?.b2b_price) || 0;
  const retail = Number(variant?.retail_price) || 0;
  if (!(b2b > 0 && retail > b2b)) return 0;
  return ((retail - b2b) / retail) * 100;
}

/** @param {{ b2b_price?: number, retail_price?: number }} variant */
export function variantMeetsCatalogMargin(variant, minPct = MIN_CATALOG_MARGIN_PCT) {
  return variantMarginOnRetailPct(variant) >= minPct;
}

/** True if any in-stock variant meets the margin rule. */
export function groupMeetsCatalogMargin(group, minPct = MIN_CATALOG_MARGIN_PCT) {
  const variants = (group?.variants || []).filter((v) => v.available !== false);
  return variants.some((v) => variantMeetsCatalogMargin(v, minPct));
}

/** Site product from portfolio import — system_data.margin_eligible set at import. */
export function isSiteProductMarginEligible(product) {
  return product?.system_data?.margin_eligible !== false;
}

/** Catalog index entry — margin_eligible baked at sync. */
export function isIndexEntryMarginEligible(entry) {
  return entry?.margin_eligible !== false;
}

/**
 * Filter catalog group variants for public display (keeps in-stock + margin OK).
 * @param {object} group
 * @param {{ includeLowMargin?: boolean }} [opts]
 */
export function filterGroupVariantsForCatalog(group, opts = {}) {
  const includeLowMargin = opts.includeLowMargin === true;
  const variants = (group?.variants || []).filter((v) => {
    if (v.available === false) return false;
    if (includeLowMargin) return true;
    return variantMeetsCatalogMargin(v);
  });
  return { ...group, variants };
}
