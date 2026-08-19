/**
 * Commercial prioritization for the Portfolio AI advisor.
 *
 * Global logic (pricing → advisor):
 * 1. `portfolio-pricing.js` resolves our actual selling price (`retail_price`) from b2b,
 *    regular, F1 sale, below_regular %, fixed overrides, etc.
 * 2. This module scores products by profit on that selling price:
 *      profit € = retail_price − b2b_price
 *      profit % = profit € / retail_price × 100
 * 3. Higher profit % → higher rank in the advisor pool; fallback to lower profit when needed.
 *
 * Promo/sale flags are NOT blanket exclusions — a product with ≤10% visible client
 * discount (or F1 competitive promo) stays eligible if profit % is acceptable.
 * Deep unprofitable pricing is handled naturally via low profit %, not promo heuristics.
 */

export const ADVISOR_COMMERCE_DEFAULTS = {
  enabled: true,
  /** Min discount vs RRP (regular vs b2b) to stay in the advisor pool. */
  min_distributor_discount_pct: 35,
  /** Fallback min markup % (retail vs b2b) when RRP is missing. */
  min_markup_pct: 15,
  /**
   * Profit % on our retail price: (retail - b2b) / retail * 100.
   * Products at or above this threshold are preferred before lower-profit fallbacks.
   */
  min_profit_pct_on_retail: 15,
  /**
   * Hard exclude only when visible client discount exceeds this AND profit % is below
   * min_profit_pct_on_retail (deep promo that erodes margin).
   */
  max_end_user_discount_pct: 10,
  /** Score boost per EUR absolute profit (best available variant). */
  margin_eur_weight: 0.12,
  /** Score boost per 10 percentage points of profit on retail price. */
  profit_pct_weight: 0.18,
  /** Legacy: score boost per 10 percentage points of distributor discount. */
  discount_pct_weight: 0.06,
};

/** Merge saved KV settings with defaults and clamp to safe ranges. */
export function normalizeAdvisorCommerceSettings(raw = {}) {
  const input = /** @type {Record<string, unknown>} */ (
    raw && typeof raw === 'object' ? raw : {}
  );
  const nested = input.commerce;
  const src = nested && typeof nested === 'object'
    ? /** @type {Record<string, unknown>} */ (nested)
    : input;
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    enabled: src.enabled !== false,
    min_distributor_discount_pct: clamp(
      src.min_distributor_discount_pct,
      0,
      80,
      ADVISOR_COMMERCE_DEFAULTS.min_distributor_discount_pct
    ),
    min_markup_pct: clamp(
      src.min_markup_pct,
      0,
      80,
      ADVISOR_COMMERCE_DEFAULTS.min_markup_pct
    ),
    min_profit_pct_on_retail: clamp(
      src.min_profit_pct_on_retail,
      0,
      80,
      ADVISOR_COMMERCE_DEFAULTS.min_profit_pct_on_retail
    ),
    max_end_user_discount_pct: clamp(
      src.max_end_user_discount_pct,
      0,
      80,
      ADVISOR_COMMERCE_DEFAULTS.max_end_user_discount_pct
    ),
    margin_eur_weight: clamp(
      src.margin_eur_weight,
      0,
      1,
      ADVISOR_COMMERCE_DEFAULTS.margin_eur_weight
    ),
    profit_pct_weight: clamp(
      src.profit_pct_weight,
      0,
      1,
      ADVISOR_COMMERCE_DEFAULTS.profit_pct_weight
    ),
    discount_pct_weight: clamp(
      src.discount_pct_weight,
      0,
      1,
      ADVISOR_COMMERCE_DEFAULTS.discount_pct_weight
    ),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Visible client discount — only when variant is marked on promo (not standard below-RRP pricing). */
export function customerDiscountPctFromVariant(variant) {
  const retail = Number(variant?.retail_price) || 0;
  if (!(retail > 0)) return 0;

  const isPromo = variant?.is_on_promo === true
    || variant?.pricing_mode === 'f1_promo';

  if (!isPromo) return 0;

  const compareAt = Number(variant?.compare_at_price) || 0;
  const regular = Number(variant?.regular_price) || 0;
  const reference = compareAt > retail ? compareAt : (regular > retail ? regular : 0);
  if (!(reference > retail)) return 0;
  return ((reference - retail) / reference) * 100;
}

/**
 * Best available variant commercial stats for a catalog group.
 * @param {object} group
 */
export function summarizeAdvisorCommercialStats(group) {
  const variants = (group?.variants || []).filter((v) => v.available !== false);
  if (!variants.length) {
    return {
      profit_eur: 0,
      profit_pct: 0,
      margin_eur: 0,
      margin_pct: 0,
      distributor_discount_pct: 0,
      customer_discount_pct: 0,
      is_on_promo: false,
      distributor: String(group?.distributor || '').toLowerCase(),
    };
  }

  let best = null;
  let maxCustomerDiscount = 0;
  let anyOnPromo = false;

  for (const v of variants) {
    const b2b = Number(v.b2b_price) || 0;
    const regular = Number(v.regular_price) || 0;
    const retail = Number(v.retail_price) || 0;

    const customerDiscount = customerDiscountPctFromVariant(v);
    if (customerDiscount > maxCustomerDiscount) maxCustomerDiscount = customerDiscount;
    if (v.is_on_promo === true || customerDiscount > 0) anyOnPromo = true;

    const profitEur = b2b > 0 && retail > b2b ? retail - b2b : 0;
    const profitPct = retail > 0 && profitEur > 0 ? (profitEur / retail) * 100 : 0;
    const marginEur = profitEur;
    const marginPct = b2b > 0 && marginEur > 0 ? (marginEur / b2b) * 100 : 0;
    const distDiscount = regular > b2b ? ((regular - b2b) / regular) * 100 : marginPct;

    const candidate = { profitEur, profitPct, marginEur, marginPct, distDiscount, customerDiscount };
    if (
      !best
      || candidate.profitPct > best.profitPct
      || (candidate.profitPct === best.profitPct && candidate.profitEur > best.profitEur)
      || (
        candidate.profitPct === best.profitPct
        && candidate.profitEur === best.profitEur
        && candidate.distDiscount > best.distDiscount
      )
    ) {
      best = candidate;
    }
  }

  return {
    profit_eur: round2(best?.profitEur || 0),
    profit_pct: round1(best?.profitPct || 0),
    margin_eur: round2(best?.marginEur || 0),
    margin_pct: round1(best?.marginPct || 0),
    distributor_discount_pct: round1(best?.distDiscount || 0),
    customer_discount_pct: round1(maxCustomerDiscount),
    is_on_promo: anyOnPromo,
    distributor: String(group?.distributor || variants[0]?.distributor || '').toLowerCase(),
  };
}

/** Attach internal commercial stats used for advisor ranking (not sent to clients). */
export function attachAdvisorCommercialStats(product, group) {
  product.system_data.portfolio = {
    ...product.system_data.portfolio,
    commerce: summarizeAdvisorCommercialStats(group),
  };
  return product;
}

export function getAdvisorCommercialStats(product) {
  return product?.system_data?.portfolio?.commerce || null;
}

export function isHighProfitAdvisorProduct(product, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  const stats = getAdvisorCommercialStats(product);
  if (!stats) return false;
  return (stats.profit_pct || 0) >= opts.min_profit_pct_on_retail;
}

/**
 * Deep client promo that also fails the profit threshold — only case we hard-exclude promos.
 */
export function isDeepUnprofitablePromo(stats, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!stats) return false;
  const clientDiscount = stats.customer_discount_pct || 0;
  const profitPct = stats.profit_pct || 0;
  return clientDiscount > opts.max_end_user_discount_pct
    && profitPct < opts.min_profit_pct_on_retail;
}

export function isExcludedByAdvisorCommerce(product, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!opts.enabled) return false;

  const stats = getAdvisorCommercialStats(product);
  if (!stats) return false;

  if (isDeepUnprofitablePromo(stats, opts)) return true;

  const dist = stats.distributor_discount_pct || 0;
  const markup = stats.margin_pct || 0;

  if (dist > 0 && dist < opts.min_distributor_discount_pct) return true;
  if (dist <= 0 && markup > 0 && markup < opts.min_markup_pct) return true;

  return false;
}

export function filterAdvisorCommercialProducts(products, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!opts.enabled) return products;
  return products.filter((p) => !isExcludedByAdvisorCommerce(p, opts));
}

/** Small additive boost on top of health/goal relevance score. */
export function scoreAdvisorCommercialBoost(product, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!opts.enabled) return 0;

  const stats = getAdvisorCommercialStats(product);
  if (!stats) return 0;

  const profitPct = stats.profit_pct || 0;
  const profitBoost = (profitPct / 10) * opts.profit_pct_weight;
  const marginBoost = (stats.profit_eur || stats.margin_eur || 0) * opts.margin_eur_weight;
  const discountPct = stats.distributor_discount_pct || stats.margin_pct || 0;
  const discountBoost = (discountPct / 10) * opts.discount_pct_weight;

  let boost = profitBoost + marginBoost + discountBoost;

  const clientDiscount = stats.customer_discount_pct || 0;
  if (clientDiscount > opts.max_end_user_discount_pct) {
    const excess = (clientDiscount - opts.max_end_user_discount_pct) / 10;
    boost -= excess * opts.profit_pct_weight * 0.5;
  }

  return Math.max(0, boost);
}
