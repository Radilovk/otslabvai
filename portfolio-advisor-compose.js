/**
 * Съставяне на пакети / единични продуктови опции за Portfolio AI консултант.
 */

import { composeProtocolStacks } from './protocol-stack-composer.js';
import { getProductPriceEur } from './protocol-quiz-engine.js';

function toStackItem(product) {
  return {
    product_id: product.product_id,
    role: 'core',
    dose: 'Според етикета',
    timing: 'сутрин с храна',
  };
}

/**
 * Единичен продукт: 3 РАЗЛИЧНИ продукта на различни ценови нива.
 * - basic: най-достъпен от топ кандидатите
 * - optimal: най-добро съответствие (rank #1)
 * - premium: премиум / по-скъп вариант
 */
export function composeSingleProductOptions(rankedEntries, tierMeta) {
  const candidates = rankedEntries.map((e) => e.product);
  if (!candidates.length) {
    throw new Error('Няма кандидати за единичен продукт.');
  }

  const optimal = candidates[0];
  const others = candidates.filter((p) => p.product_id !== optimal.product_id);

  const pickCheapest = (list) => [...list].sort((a, b) => getProductPriceEur(a) - getProductPriceEur(b))[0];
  const pickPriciest = (list) => [...list].sort((a, b) => getProductPriceEur(b) - getProductPriceEur(a))[0];

  let basic = others.length ? pickCheapest(others) : candidates[1] || optimal;
  let premium = others.length ? pickPriciest(others) : candidates[2] || optimal;

  const ensureDistinct = () => {
    const picks = { optimal, basic, premium };
    const ids = new Set([optimal.product_id, basic.product_id, premium.product_id]);
    if (ids.size >= 3 || candidates.length < 3) return;

    const unused = candidates.filter((p) => !ids.has(p.product_id));
    if (!unused.length) return;

    if (basic.product_id === optimal.product_id) {
      basic = pickCheapest(unused) || unused[0];
    }
    if (premium.product_id === optimal.product_id || premium.product_id === basic.product_id) {
      const pool = candidates.filter((p) => p.product_id !== optimal.product_id && p.product_id !== basic.product_id);
      premium = pickPriciest(pool) || pool[0] || premium;
    }
  };

  ensureDistinct();

  return {
    recommended_tier: 'optimal',
    tiers: {
      basic: { ...tierMeta.basic, products: [toStackItem(basic)] },
      optimal: { ...tierMeta.optimal, products: [toStackItem(optimal)] },
      premium: { ...tierMeta.premium, products: [toStackItem(premium)] },
    },
    meta: {
      mode: 'single',
      ranked_pool_size: candidates.length,
      distinct_products: new Set([basic.product_id, optimal.product_id, premium.product_id]).size,
      tier_product_ids: {
        basic: basic.product_id,
        optimal: optimal.product_id,
        premium: premium.product_id,
      },
    },
  };
}

export function composePortfolioAdvisorStacks(profile, rankedEntries, options = {}) {
  if (profile.selection_mode === 'single') {
    return composeSingleProductOptions(rankedEntries, options.tierMeta || {});
  }
  return composeProtocolStacks(profile, rankedEntries, options);
}
