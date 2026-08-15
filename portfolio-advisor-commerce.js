/**
 * Commercial prioritization for the Portfolio AI advisor.
 * Prefers in-stock SKUs with strong profit % on retail price and no end-user promo.
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
      has_end_user_promo: false,
      distributor: String(group?.distributor || '').toLowerCase(),
    };
  }

  let best = null;
  let hasEndUserPromo = false;

  for (const v of variants) {
    const b2b = Number(v.b2b_price) || 0;
    const regular = Number(v.regular_price) || 0;
    const retail = Number(v.retail_price) || 0;
    const sale = Number(v.sale_price) || 0;

    if (sale > 0 || v.is_on_promo === true || v.pricing_mode === 'f1_promo') {
      hasEndUserPromo = true;
    }

    const profitEur = b2b > 0 && retail > b2b ? retail - b2b : 0;
    const profitPct = retail > 0 && profitEur > 0 ? (profitEur / retail) * 100 : 0;
    const marginEur = profitEur;
    const marginPct = b2b > 0 && marginEur > 0 ? (marginEur / b2b) * 100 : 0;
    const distDiscount = regular > b2b ? ((regular - b2b) / regular) * 100 : marginPct;

    const candidate = { profitEur, profitPct, marginEur, marginPct, distDiscount };
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
    has_end_user_promo: hasEndUserPromo,
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

export function isExcludedByAdvisorCommerce(product, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!opts.enabled) return false;

  const stats = getAdvisorCommercialStats(product);
  if (!stats) return false;

  if (stats.has_end_user_promo) return true;

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
  if (!stats || stats.has_end_user_promo) return 0;

  const profitPct = stats.profit_pct || 0;
  const profitBoost = (profitPct / 10) * opts.profit_pct_weight;
  const marginBoost = (stats.profit_eur || stats.margin_eur || 0) * opts.margin_eur_weight;
  const discountPct = stats.distributor_discount_pct || stats.margin_pct || 0;
  const discountBoost = (discountPct / 10) * opts.discount_pct_weight;

  return profitBoost + marginBoost + discountBoost;
}
