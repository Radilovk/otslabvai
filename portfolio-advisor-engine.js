/**
 * Portfolio AI консултант — адаптер върху protocol-quiz-engine за пълния portfolio каталог.
 */

import { getPortfolioMeta } from './portfolio-api.js';
import { portfolioGroupToSiteProduct, applyProductOverrides } from './portfolio-import.js';
import { GOAL_KEYWORD_HINTS, inferProductGoals } from './portfolio-goals.js';
import {
  buildClientProfile,
  buildCandidatePool,
  rankEligibleProducts,
  getProductPriceEur,
  eurToBgn,
  isProductAvailable,
  isPeptideOrInjectable,
  transformProductForAI,
  normalizeCumulativeBenefits,
} from './protocol-quiz-engine.js';
import { getMustIncludeKeywords } from './protocol-safety-rules.js';

const CHUNK_KEY = (n) => `portfolio_chunk_${n}`;
const KV_SETTINGS = 'portfolio_settings';

export const PORTFOLIO_PACKAGE_TIER_LIMITS = {
  basic: { min: 2, max: 3, budgetEur: 55 },
  optimal: { min: 3, max: 5, budgetEur: 95 },
  premium: { min: 4, max: 6, budgetEur: 150 },
};

export const PORTFOLIO_PACKAGE_TIER_META = {
  basic: { name: 'Стартов пакет', tagline: 'Основни продукти за целта' },
  optimal: { name: 'Оптимален пакет', tagline: 'Най-добра стойност за профила' },
  premium: { name: 'Пълен пакет', tagline: 'Максимално покритие на нуждите' },
};

export const PORTFOLIO_SINGLE_TIER_LIMITS = {
  basic: { min: 1, max: 1, budgetEur: 25 },
  optimal: { min: 1, max: 1, budgetEur: 45 },
  premium: { min: 1, max: 1, budgetEur: 80 },
};

export const PORTFOLIO_SINGLE_TIER_META = {
  basic: { name: 'Икономичен избор', tagline: 'Добра стойност за целта' },
  optimal: { name: 'Препоръчан продукт', tagline: 'Най-добро съответствие с профила' },
  premium: { name: 'Премиум избор', tagline: 'Топ марка и формула' },
};

export function filterPortfolioEligibleProducts(products) {
  return products.filter((p) => isProductAvailable(p) && !isPeptideOrInjectable(p));
}

function getCheapestVariant(product) {
  const variants = (product.public_data?.variants || []).filter((v) => v.available !== false && v.price > 0);
  if (!variants.length) return null;
  return variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min));
}

export function enrichPortfolioProductItem(item, product) {
  const priceEur = getProductPriceEur(product);
  const variant = getCheapestVariant(product);
  const groupId = product.system_data?.portfolio?.group_id
    || String(product.product_id || '').replace(/^prod-pf-/, '');

  return {
    ...item,
    name: product.public_data?.name,
    brand: product.public_data?.brand,
    price_eur: Math.round(priceEur * 100) / 100,
    price_bgn: eurToBgn(priceEur),
    image_url: variant?.image_url || product.public_data?.image_url || '',
    variant_name: variant?.option_name || '',
    sku_id: variant?.sku || '',
    group_id: groupId,
    product_url: `portfolio-product.html?group_id=${encodeURIComponent(groupId)}`,
  };
}

export function finalizePortfolioAdvisorResponse(response, eligibleProducts, excludedProductIds = []) {
  const excluded = new Set(excludedProductIds);
  const productMap = new Map(eligibleProducts.map((p) => [p.product_id, p]));

  if (!response?.tiers?.basic || !response?.tiers?.optimal || !response?.tiers?.premium) {
    throw new Error('Липсват трите ценови класа в отговора.');
  }

  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = response.tiers[key];
    if (!Array.isArray(tier.products) || !tier.products.length) {
      throw new Error(`Tier "${key}" няма продукти.`);
    }
    for (const item of tier.products) {
      const pid = item.product_id;
      const product = productMap.get(pid);
      if (!product) throw new Error(`Липсва продукт в каталога: ${pid}`);
      if (excluded.has(pid)) throw new Error(`Изключен продукт в пакета: ${pid}`);
    }
    tier.products = tier.products.map((item) => enrichPortfolioProductItem(item, productMap.get(item.product_id)));
    const totalEur = tier.products.reduce((s, i) => s + (i.price_eur || 0), 0);
    tier.monthly_total_eur = Math.round(totalEur * 100) / 100;
    tier.monthly_total_bgn = eurToBgn(totalEur);
    if (!Array.isArray(tier.benefits)) tier.benefits = [];
  }

  const rec = response.recommended_tier;
  if (!['basic', 'optimal', 'premium'].includes(rec)) {
    response.recommended_tier = 'optimal';
  }

  return normalizeCumulativeBenefits(response);
}

async function loadPortfolioSettings(env) {
  const raw = await env.PAGE_CONTENT?.get(KV_SETTINGS);
  if (!raw) return { product_overrides: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { product_overrides: {} };
  }
}

function attachGoals(product, group, settings) {
  const entry = {
    group_id: group.group_id,
    name: group.name,
    brand: group.brand,
    category: group.category,
    category_top: group.category_path?.[0] || '',
    category_path: group.category_path || [],
    search_text: [group.name, group.brand, group.category].filter(Boolean).join(' '),
  };
  product.system_data.goals = inferProductGoals(entry, settings);
  return product;
}

/** Зарежда всички налични portfolio групи като хомогенни продукти за scoring engine. */
export async function loadPortfolioCatalogProducts(env) {
  const meta = await getPortfolioMeta(env);
  if (!meta?.chunk_count) return [];

  const settings = await loadPortfolioSettings(env);
  const overrides = settings.product_overrides || {};
  const products = [];

  for (let i = 0; i < meta.chunk_count; i++) {
    const raw = await env.PAGE_CONTENT?.get(CHUNK_KEY(i));
    if (!raw) continue;
    for (const group of JSON.parse(raw)) {
      const hasStock = (group.variants || []).some((v) => v.available);
      if (!hasStock) continue;

      let product = portfolioGroupToSiteProduct(group);
      const override = overrides[group.group_id];
      if (override) product = applyProductOverrides(product, override);
      attachGoals(product, group, settings);
      products.push(product);
    }
  }

  return products;
}

export function getPortfolioComposeOptions(profile) {
  if (profile.selection_mode === 'single') {
    return {
      tierLimits: PORTFOLIO_SINGLE_TIER_LIMITS,
      tierMeta: PORTFOLIO_SINGLE_TIER_META,
    };
  }
  return {
    tierLimits: PORTFOLIO_PACKAGE_TIER_LIMITS,
    tierMeta: PORTFOLIO_PACKAGE_TIER_META,
  };
}

export async function preparePortfolioAdvisorSubmission(env, rawAnswers, { compositionMode = 'compose_narrate' } = {}) {
  const profile = buildClientProfile(rawAnswers);
  if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    throw new Error('Невалиден имейл адрес.');
  }
  if (!profile.priority) throw new Error('Липсва основна цел.');

  const allProducts = await loadPortfolioCatalogProducts(env);
  const eligible = filterPortfolioEligibleProducts(allProducts);

  if (eligible.length < 3) {
    throw new Error('Няма достатъчно налични продукти за персонална препоръка. Моля, опитайте по-късно.');
  }

  const rankedResult = rankEligibleProducts(profile, eligible, { priorityKeywords: GOAL_KEYWORD_HINTS });

  if (rankedResult.ranked.length < 3) {
    throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
  }

  const mustIncludeKws = getMustIncludeKeywords(profile);
  const isSingle = profile.selection_mode === 'single';
  const priceCeiling = isSingle
    ? { basic_target: 25, premium_max: 80 }
    : { basic_target: 55, premium_max: 150 };
  const tierCounts = isSingle
    ? { basic: '1', optimal: '1', premium: '1' }
    : { basic: '2-3', optimal: '3-5', premium: '4-6' };

  if (compositionMode === 'ai_pick') {
    const { candidates, excluded_product_ids, exclusion_map } = buildCandidatePool(profile, eligible, {
      priorityKeywords: GOAL_KEYWORD_HINTS,
    });
    if (candidates.length < 3) {
      throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
    }
    const payload = {
      client_profile: profile,
      priority_summary: profile.priority,
      composition_mode: 'ai_pick',
      candidate_products: candidates.map(transformProductForAI),
      constraints: {
        excluded_product_ids,
        must_include_keywords: mustIncludeKws,
        oral_only: false,
        selection_mode: profile.selection_mode,
        price_ceiling_eur: priceCeiling,
        tier_product_counts: tierCounts,
      },
      exclusion_map,
      catalog_stats: {
        total_in_catalog: allProducts.length,
        eligible_available: eligible.length,
        ranked_pool_size: rankedResult.ranked.length,
        candidates_sent_to_ai: candidates.length,
      },
    };
    return {
      profile,
      payload,
      candidates,
      eligible,
      ranked: rankedResult.ranked,
      excluded_product_ids,
      exclusion_map,
      compositionMode,
    };
  }

  const payload = {
    client_profile: profile,
    priority_summary: profile.priority,
    composition_mode: 'compose_narrate',
    constraints: {
      excluded_product_ids: rankedResult.excluded_product_ids,
      must_include_keywords: mustIncludeKws,
      oral_only: false,
      selection_mode: profile.selection_mode,
      price_ceiling_eur: priceCeiling,
      tier_product_counts: tierCounts,
    },
    exclusion_map: rankedResult.exclusion_map,
    catalog_stats: {
      total_in_catalog: allProducts.length,
      eligible_available: eligible.length,
      ranked_pool_size: rankedResult.ranked.length,
      candidates_sent_to_ai: 0,
    },
  };

  return {
    profile,
    payload,
    eligible,
    ranked: rankedResult.ranked,
    excluded_product_ids: rankedResult.excluded_product_ids,
    exclusion_map: rankedResult.exclusion_map,
    compositionMode,
  };
}
