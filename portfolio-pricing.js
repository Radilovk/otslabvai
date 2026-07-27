/**
 * Competitive pricing vs Fitness1 – uses regular_price / sale_price from products_v3.
 * Goal: strictly below F1 customer price when profitable (retail > b2b).
 */

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

/** @type {{ undercut_eur: number, min_profit_eur: number }} */
export const DEFAULT_PRICING_POLICY = {
  undercut_eur: 0.10,
  min_profit_eur: 0.01
};

/** Active F1 end-customer price (promo sale wins over regular list price). */
export function getF1CustomerPrice(regularPrice, salePrice) {
  const regular = Number(regularPrice) || 0;
  const sale = Number(salePrice) || 0;
  if (sale > 0 && (regular <= 0 || sale < regular)) return roundPrice(sale);
  if (regular > 0) return roundPrice(regular);
  return 0;
}

/** F1 runs a visible promo (sale below regular). */
export function isF1PromoActive(regularPrice, salePrice) {
  const regular = Number(regularPrice) || 0;
  const sale = Number(salePrice) || 0;
  return sale > 0 && regular > 0 && sale < regular;
}

/**
 * Largest price strictly below reference after undercut (2-decimal EUR).
 * @param {number} reference
 * @param {number} [undercutEur]
 */
export function priceStrictlyBelow(reference, undercutEur = DEFAULT_PRICING_POLICY.undercut_eur) {
  const ref = Number(reference) || 0;
  if (!(ref > 0)) return 0;
  const step = Math.max(Number(undercutEur) || 0.01, 0.01);
  let candidate = roundPrice(ref - step);
  if (candidate >= ref) candidate = roundPrice(ref - 0.01);
  if (candidate <= 0) return 0;
  return candidate;
}

/**
 * @param {object} input
 * @param {number} input.b2b
 * @param {number} [input.regular]
 * @param {number} [input.sale]
 * @param {number} [input.markupPercent]
 * @param {object} [input.override]
 * @param {string} [input.skuId]
 * @param {() => number} [input.markupRetail] - fallback retail from markup + charm
 * @param {object} [input.policy]
 * @returns {{
 *   retail_price: number,
 *   compare_at_price: number,
 *   is_on_promo: boolean,
 *   f1_reference_price: number,
 *   pricing_mode: 'competitive'|'markup'|'fixed_override'|'floor'
 * }}
 */
export function resolveVariantPricing(input) {
  const policy = { ...DEFAULT_PRICING_POLICY, ...input.policy };
  const b2b = Number(input.b2b) || 0;
  const floor = roundPrice(b2b + policy.min_profit_eur);
  const regular = Number(input.regular) || 0;
  const sale = Number(input.sale) || 0;
  const f1Ref = getF1CustomerPrice(regular, sale);
  const onPromo = isF1PromoActive(regular, sale);

  if (input.override && typeof input.override.fixed_price === 'number') {
    const fixed = roundPrice(input.override.fixed_price);
    return {
      retail_price: Math.max(floor, fixed),
      compare_at_price: onPromo && regular > fixed ? regular : 0,
      is_on_promo: onPromo,
      f1_reference_price: f1Ref,
      pricing_mode: 'fixed_override'
    };
  }

  if (f1Ref > floor) {
    let competitive = priceStrictlyBelow(f1Ref, policy.undercut_eur);
    competitive = Math.max(floor, competitive);
    if (competitive >= f1Ref) competitive = roundPrice(f1Ref - 0.01);
    if (competitive < floor) competitive = floor;

    const belowF1 = competitive < f1Ref;
    const compareAt = onPromo && regular > competitive
      ? regular
      : (belowF1 ? f1Ref : 0);

    return {
      retail_price: competitive,
      compare_at_price: compareAt,
      is_on_promo: onPromo || belowF1,
      f1_reference_price: f1Ref,
      pricing_mode: belowF1 ? 'competitive' : 'floor'
    };
  }

  const markupRetail = typeof input.markupRetail === 'function'
    ? Number(input.markupRetail()) || 0
    : 0;
  const retail = Math.max(floor, markupRetail);

  return {
    retail_price: retail,
    compare_at_price: 0,
    is_on_promo: false,
    f1_reference_price: f1Ref,
    pricing_mode: 'markup'
  };
}

/** Summarize promo/compare fields for a catalog group index row. */
export function summarizeGroupPricing(variants) {
  const list = variants || [];
  const priced = list.filter((v) => (Number(v.retail_price) || 0) > 0);
  const minPrice = priced.length ? Math.min(...priced.map((v) => v.retail_price)) : 0;
  const maxPrice = priced.length ? Math.max(...priced.map((v) => v.retail_price)) : 0;
  const promoPriced = list.filter(
    (v) => v.is_on_promo && (Number(v.compare_at_price) || 0) > (Number(v.retail_price) || 0)
  );
  const compareAt = promoPriced.length
    ? Math.max(...promoPriced.map((v) => Number(v.compare_at_price) || 0))
    : 0;

  return {
    min_price: minPrice,
    max_price: maxPrice,
    has_promo: promoPriced.length > 0,
    compare_at_price: compareAt
  };
}
