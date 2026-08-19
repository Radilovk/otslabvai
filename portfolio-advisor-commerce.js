/**
 * Commercial prioritization for the Portfolio AI advisor.
 * Uses unified 25% margin-on-retail rule (portfolio-margin-policy.js).
 */

import {
  MIN_CATALOG_MARGIN_PCT,
  variantMarginOnRetailPct,
} from './portfolio-margin-policy.js';

export const ADVISOR_COMMERCE_DEFAULTS = {
  enabled: true,
  /** Prefer products at or above this margin-on-retail % when building advisor pools. */
  min_profit_pct_on_retail: 15,
  /** Score boost per EUR absolute margin (best available variant). */
  margin_eur_weight: 0.12,
  /** Score boost per 10 percentage points of margin on retail. */
  margin_on_retail_weight: 0.10,
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
    margin_on_retail_weight: clamp(
      src.margin_on_retail_weight ?? src.discount_pct_weight,
      0,
      1,
      ADVISOR_COMMERCE_DEFAULTS.margin_on_retail_weight
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
      margin_eur: 0,
      margin_pct: 0,
      margin_on_retail_pct: 0,
      catalog_margin_ok: false,
      distributor: String(group?.distributor || '').toLowerCase(),
    };
  }

  let best = null;

  for (const v of variants) {
    const b2b = Number(v.b2b_price) || 0;
    const retail = Number(v.retail_price) || 0;
    const marginEur = b2b > 0 && retail > b2b ? retail - b2b : 0;
    const marginOnRetail = variantMarginOnRetailPct(v);
    const marginPct = b2b > 0 && marginEur > 0 ? (marginEur / b2b) * 100 : 0;

    const candidate = { marginEur, marginPct, marginOnRetail };
    if (
      !best
      || candidate.marginOnRetail > best.marginOnRetail
      || (candidate.marginOnRetail === best.marginOnRetail && candidate.marginEur > best.marginEur)
    ) {
      best = candidate;
    }
  }

  const marginOnRetail = best?.marginOnRetail || 0;

  return {
    margin_eur: round2(best?.marginEur || 0),
    margin_pct: round1(best?.marginPct || 0),
    margin_on_retail_pct: round1(marginOnRetail),
    catalog_margin_ok: marginOnRetail >= MIN_CATALOG_MARGIN_PCT,
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

export function isExcludedByAdvisorCommerce(product, options = ADVISOR_COMMERCE_DEFAULTS) {
  const opts = normalizeAdvisorCommerceSettings(options);
  if (!opts.enabled) return false;

  const stats = getAdvisorCommercialStats(product);
  if (!stats) return false;

  return stats.catalog_margin_ok !== true;
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
  if (!stats || !stats.catalog_margin_ok) return 0;

  const marginBoost = (stats.margin_eur || 0) * opts.margin_eur_weight;
  const retailMarginBoost = ((stats.margin_on_retail_pct || 0) / 10) * opts.margin_on_retail_weight;

  return marginBoost + retailMarginBoost;
}
