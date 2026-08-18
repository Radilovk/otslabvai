/**
 * Движково ядро за site-specific AI консултанти (life, main).
 */

import { finalizeSiteAnswers, buildAdvisorClinicalGuardrails } from './site-advisor-shared.js';
import {
  buildClientProfile,
  extractProductsFromContent,
  filterEligibleProducts,
  buildCandidatePool,
  refreshLifeProductsAvailability,
  transformProductForAI,
  enrichProtocolProductItem,
  scoreProduct,
} from './protocol-quiz-engine.js';
import {
  getExclusionReasons,
  getMustIncludeKeywords,
  productMatchesAnyKeyword,
  productSearchText,
  profileHasPregnancyOrBreastfeeding,
} from './protocol-safety-rules.js';

/** Ключови думи по сайт — продуктите вече са филтрирани по каталог, това е scoring hint. */
export const SITE_GOAL_KEYWORDS = {
  longevity: [
    'дълголет', 'longevity', 'антиейдж', 'anti-aging', 'регенера', 'telomer', 'теломер', 'nad',
    'кожа', 'skin', 'колаген', 'collagen', 'еластич', 'хиалурон', 'hyaluronic',
    'став', 'joint', 'глюкозамин', 'glucosamine', 'подвижност',
    'енерги', 'energy', 'метабол', 'коензим', 'coq10', 'магнезий', 'magnesium',
    'сън', 'sleep', 'мелатонин', 'melatonin', 'възстанов',
    'когнитив', 'cognit', 'памет', 'memory', 'фокус', 'focus', 'мозък', 'brain',
    'антиоксидант', 'antioxid', 'resveratrol', 'ресвератрол', 'astaxanthin',
  ],
  otshalvane: [
    'отслаб', 'slim', 'fat', 'burn', 'thermo', 'fat burner', 'лида', 'lida',
    'апетит', 'appetite', 'ситост', 'craving', 'глад', 'hunger',
    'метабол', 'metabol', 'l-carnitine', 'карнитин', 'carnitine', 'cla',
    'protein', 'протеин', 'whey', 'isolate', 'fiber', 'фибри',
    'berberine', 'берберин', 'chromium', 'хром', 'green tea', 'зелен чай',
    'weight', 'диет', 'diet', 'калори', 'calori', 'detox', 'детокс',
  ],
};

function getSitePriorityKeywordMap(siteId) {
  const priority = siteId === 'main' ? 'otshalvane' : 'longevity';
  return { [priority]: SITE_GOAL_KEYWORDS[priority] };
}

export function buildSiteAdvisorProfile(rawAnswers, siteId = 'life') {
  const finalized = finalizeSiteAnswers(rawAnswers, siteId);
  return buildClientProfile(finalized);
}

export function scoreSiteAdvisorProduct(product, profile, siteId = 'life') {
  const keywordMap = getSitePriorityKeywordMap(siteId);
  let score = scoreProduct(product, profile, keywordMap);
  const text = productSearchText(product);

  if (profile.activity === 'regular' && siteId === 'main') {
    if (productMatchesAnyKeyword(text, ['protein', 'протеин', 'bcaa', 'l-carnitine', 'карнитин'])) score += 2;
  }

  if (profile.symptoms?.includes('joint_pain') && productMatchesAnyKeyword(text, ['joint', 'став', 'колаген', 'collagen'])) {
    score += 2;
  }
  if (profile.symptoms?.includes('low_appetite') && siteId === 'main') {
    if (productMatchesAnyKeyword(text, ['appetite', 'апетит', 'ситост', 'fiber', 'фибри', 'protein', 'протеин'])) score += 2;
  }
  if (profile.symptoms?.includes('poor_sleep') && productMatchesAnyKeyword(text, ['sleep', 'сън', 'melatonin', 'мелатонин', 'магнезий'])) {
    score += 1;
  }

  const conditions = profile.conditions || [];
  if (conditions.some((c) => ['hypertension', 'cardiovascular'].includes(c))) {
    if (productMatchesAnyKeyword(text, ['thermogenic', 'fat burn', 'fat burner', 'preworkout', 'pre-workout', 'предтрен', 'йохимбин'])) {
      score -= 20;
    }
  }
  if (profileHasPregnancyOrBreastfeeding(profile)) {
    if (productMatchesAnyKeyword(text, ['for men', 'for man', ' men ', ' man ', 'за мъже', 'saw palmetto', 'palmetto', 'echinacea', 'ехинацея'])) {
      score -= 25;
    }
  }
  if (conditions.includes('kidney') && productMatchesAnyKeyword(text, ['protein', 'протеин', 'gainer', 'гейн', 'creatine', 'креатин'])) {
    score -= 15;
  }

  return score;
}

export function rankSiteAdvisorProducts(profile, products, siteId = 'life') {
  const excluded = new Map();
  const ranked = [];

  for (const product of products) {
    const reasons = getExclusionReasons(profile, product);
    if (reasons.length) {
      excluded.set(product.product_id, reasons);
      continue;
    }
    ranked.push({ product, score: scoreSiteAdvisorProduct(product, profile, siteId) });
  }

  ranked.sort((a, b) => b.score - a.score);

  return {
    ranked,
    excluded_product_ids: Array.from(excluded.keys()),
    exclusion_map: Object.fromEntries(excluded),
  };
}

export function enrichSiteProductItem(item, product, siteId = 'life') {
  const base = enrichProtocolProductItem(item, product, siteId);
  return base;
}

export function finalizeSiteAdvisorResponse(response, eligibleProducts, excludedProductIds = [], siteId = 'life') {
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
      if (excluded.has(pid)) throw new Error(`Изключен продукт в стака: ${pid}`);
    }
    tier.products = tier.products.map((item) => enrichSiteProductItem(item, productMap.get(item.product_id), siteId));
    const totalEur = tier.products.reduce((s, i) => s + (i.price_eur || 0), 0);
    tier.monthly_total_eur = Math.round(totalEur * 100) / 100;
    tier.monthly_total_bgn = Math.round(totalEur * 1.95583 * 100) / 100;
    if (!Array.isArray(tier.benefits)) tier.benefits = [];
  }

  const rec = response.recommended_tier;
  if (!['basic', 'optimal', 'premium'].includes(rec)) {
    response.recommended_tier = 'optimal';
  }

  return response;
}

export async function prepareSiteAdvisorSubmission(env, rawAnswers, deps, {
  siteId = 'life',
  compositionMode = 'compose_narrate',
} = {}) {
  const profile = buildSiteAdvisorProfile(rawAnswers, siteId);
  if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    throw new Error('Невалиден имейл адрес.');
  }

  const project = siteId === 'main' ? 'main' : 'life';
  let content = await deps.loadProjectContent(env, project);
  if (project === 'life') {
    content = await refreshLifeProductsAvailability(env, content, deps.loadGroupsByIds);
  }

  const allProducts = extractProductsFromContent(content);
  const eligible = filterEligibleProducts(allProducts);

  if (eligible.length < 3) {
    throw new Error('Няма достатъчно налични орални продукти за персонална препоръка. Моля, опитайте по-късно.');
  }

  const keywordMap = getSitePriorityKeywordMap(siteId);
  const rankedResult = rankSiteAdvisorProducts(profile, eligible, siteId);

  if (rankedResult.ranked.length < 3) {
    throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
  }

  const mustIncludeKws = getMustIncludeKeywords(profile);
  const tierCounts = siteId === 'main'
    ? { basic: '2-3', optimal: '3-5', premium: '4-6' }
    : { basic: '3-4', optimal: '5-6', premium: '6-8' };
  const priceCeiling = siteId === 'main'
    ? { basic_target: 35, premium_max: 120 }
    : { basic_target: 25, premium_max: 100 };

  if (compositionMode === 'ai_pick') {
    const { candidates, excluded_product_ids, exclusion_map } = buildCandidatePool(
      profile,
      eligible,
      { maxCandidates: 18, priorityKeywords: keywordMap },
    );

    if (candidates.length < 3) {
      throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
    }

    const payload = {
      client_profile: profile,
      clinical_guardrails: buildAdvisorClinicalGuardrails(profile, siteId),
      site_id: siteId,
      priority_summary: profile.priority,
      composition_mode: 'ai_pick',
      candidate_products: candidates.map(transformProductForAI),
      constraints: {
        excluded_product_ids,
        must_include_keywords: mustIncludeKws,
        oral_only: true,
        price_ceiling_eur: priceCeiling,
        tier_product_counts: tierCounts,
      },
      exclusion_map,
      catalog_stats: {
        total_in_catalog: allProducts.length,
        eligible_available: eligible.length,
        ranked_pool_size: rankedResult.ranked.length,
        candidates_sent_to_ai: candidates.length,
        site_id: siteId,
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
      content,
      siteId,
    };
  }

  const payload = {
    client_profile: profile,
    clinical_guardrails: buildAdvisorClinicalGuardrails(profile, siteId),
    site_id: siteId,
    priority_summary: profile.priority,
    composition_mode: 'compose_narrate',
    constraints: {
      excluded_product_ids: rankedResult.excluded_product_ids,
      must_include_keywords: mustIncludeKws,
      oral_only: true,
      price_ceiling_eur: priceCeiling,
      tier_product_counts: tierCounts,
    },
    exclusion_map: rankedResult.exclusion_map,
    catalog_stats: {
      total_in_catalog: allProducts.length,
      eligible_available: eligible.length,
      ranked_pool_size: rankedResult.ranked.length,
      candidates_sent_to_ai: 0,
      site_id: siteId,
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
    content,
    siteId,
  };
}
