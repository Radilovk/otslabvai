/**
 * Филтри и нормализация на каталога за Portfolio AI консултант.
 */

import { getProductPriceEur } from './protocol-quiz-engine.js';
import { productSearchText } from './protocol-safety-rules.js';
import { decodeHtmlEntities } from './portfolio-text.js';

export { decodeHtmlEntities };

/** Минимална retail цена (EUR) за tier „икономичен“ при единичен продукт */
export const SINGLE_MODE_BASIC_MIN_EUR = 9;

const SAMPLE_NAME_TERMS = [
  'мостра', 'мостри', 'пробен', 'проба', 'саше', 'пакетче', 'единична доза', 'единична доз', 'единично доз',
  'sample', 'samples', 'trial', 'tester', 'test pack', 'sachet', 'stick pack', 'single serve', 'single dose',
];

const SAMPLE_NAME_RE = new RegExp(
  `(?:^|[^a-zA-Zа-яА-Я0-9])(?:${SAMPLE_NAME_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|1\\s*x\\s*\\d+\\s*(?:ml|g|gr|г|мл))(?:[^a-zA-Zа-яА-Я0-9]|$)`,
  'i'
);

const SAMPLE_PACK_RE = /^(1\s*(бр\.?|pcs?|pc|x|порц|доза?|dose|serving|shot|stick)|мостра|sample|проба|trial|tester|single)/i;

const TINY_PACK_RE = /^\d{1,2}\s*(ml|мл|g|г|gr)\b/i;

export function isAdvisorExcludedProduct(product) {
  const name = decodeHtmlEntities(product.public_data?.name || '');
  const tagline = decodeHtmlEntities(product.public_data?.tagline || '');
  if (SAMPLE_NAME_RE.test(name) || SAMPLE_NAME_RE.test(tagline)) return true;

  const variants = (product.public_data?.variants || []).filter((v) => v.available !== false);
  if (!variants.length) return false;

  const labels = variants.map((v) => decodeHtmlEntities(v.option_name || '')).filter(Boolean);
  const portfolioLabels = product.system_data?.portfolio?.variant_labels || [];
  const allLabels = [...labels, ...portfolioLabels.map(decodeHtmlEntities)];

  if (allLabels.length && allLabels.every((label) => isSamplePackLabel(label))) {
    return true;
  }

  const cheapest = Math.min(...variants.map((v) => Number(v.price) || Infinity));
  if (cheapest < 5 && allLabels.some((label) => isSamplePackLabel(label) || TINY_PACK_RE.test(label))) {
    return true;
  }

  return false;
}

export function isSamplePackLabel(label) {
  const text = String(label || '').trim();
  if (!text) return false;
  return SAMPLE_PACK_RE.test(text) || TINY_PACK_RE.test(text);
}

/**
 * @param {object[]} products
 * @param {{ selectionMode?: string }} [options]
 */
export function filterAdvisorRetailProducts(products, options = {}) {
  const selectionMode = options.selectionMode;
  return products.filter((p) => {
    if (isAdvisorExcludedProduct(p)) return false;
    if (selectionMode === 'single' && getProductPriceEur(p) < 4) return false;
    return true;
  });
}

export function pickSingleModeBasicProduct(candidates) {
  const retail = candidates.filter((p) => getProductPriceEur(p) >= SINGLE_MODE_BASIC_MIN_EUR);
  const pool = retail.length ? retail : candidates.filter((p) => getProductPriceEur(p) >= 5);
  const sorted = [...(pool.length ? pool : candidates)].sort((a, b) => getProductPriceEur(a) - getProductPriceEur(b));
  return sorted[0];
}

export function pickSingleModePremiumProduct(candidates, excludeIds = new Set()) {
  const pool = candidates.filter((p) => !excludeIds.has(p.product_id));
  return [...pool].sort((a, b) => getProductPriceEur(b) - getProductPriceEur(a))[0];
}

export function sanitizeAdvisorProductName(name) {
  return decodeHtmlEntities(name || '').replace(/\s+/g, ' ').trim();
}

export function advisorProductSearchText(product) {
  return productSearchText({
    ...product,
    public_data: {
      ...product.public_data,
      name: sanitizeAdvisorProductName(product.public_data?.name),
    },
  });
}
