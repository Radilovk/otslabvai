/**
 * Детерминистично ядро за Life Protocol Quiz:
 * наличност, oral-only, safety, scoring → candidate pool за AI.
 */

import {
  collectImportedGroupIds,
  refreshImportedProductsInContent,
} from './portfolio-import.js';
import {
  getExclusionReasons,
  getMustIncludeKeywords,
  productMatchesAnyKeyword,
  productSearchText,
} from './protocol-safety-rules.js';
import {
  assembleProtocolFromComposition,
  buildMockNarration,
  composeProtocolStacks,
} from './protocol-stack-composer.js';

/** Официален фиксиран курс BGN/EUR — цените в каталога са в EUR */
export const EUR_RATE = 1.95583;

export function formatPriceEur(amount) {
  return `${Number(amount || 0).toFixed(2)} €`;
}

export function eurToBgn(eur) {
  return Math.round(Number(eur || 0) * EUR_RATE * 100) / 100;
}

const PRIORITY_GOAL_KEYWORDS = {
  skin: ['кожа', 'skin', 'колаген', 'collagen', 'еластич', 'антиейджинг', 'anti-aging', 'хиалурон', 'hyaluronic'],
  joints: ['став', 'joint', 'хондро', 'chondro', 'глюкозамин', 'glucosamine', 'подвижност', 'mobility'],
  energy: ['енерги', 'energy', 'метабол', 'умора', 'fatigue', 'коензим', 'coq10', 'b12', 'желязо'],
  sleep: ['сън', 'sleep', 'мелатонин', 'melatonin', 'възстанов', 'recovery', 'магнезий'],
  cognition: ['когнитив', 'cognit', 'памет', 'memory', 'фокус', 'focus', 'мозък', 'brain', 'невро'],
  longevity: ['дълголет', 'longevity', 'антиейджинг', 'anti-aging', 'регенера', 'telomer', 'теломер', 'nad'],
};

const SYMPTOM_KEYWORDS = {
  cramps: ['магнезий', 'magnesium', 'калций', 'calcium', 'калий', 'potassium'],
  fatigue: ['желязо', 'iron', 'b12', 'b-12', 'коензим', 'coq10', 'енерги', 'ашваганда', 'rhodiola'],
  hair_nails: ['биотин', 'biotin', 'цинк', 'zinc', 'колаген', 'collagen', 'силиций', 'silicon'],
  concentration: ['омега', 'omega', 'dha', 'фосфатидил', 'phosphatidyl', 'ginkgo', 'гинко', 'bacopa'],
};

const PEPTIDE_KEYWORDS = [
  'пептид', 'peptide', 'bpc-157', 'bpc157', 'tb-500', 'tb500', 'semaglutide', 'tirzepatide',
  'ipamorelin', 'cjc-1295', 'ghk-cu', 'injectable', 'инжекти', 'subq', 'subcutaneous',
];

/** Извлича всички продукти от page content */
export function extractProductsFromContent(pageContent) {
  if (!pageContent?.page_content) return [];
  return pageContent.page_content
    .filter((c) => c.type === 'product_category' && Array.isArray(c.products))
    .flatMap((c) => c.products);
}

/** Опреснява наличности от portfolio каталог (in-memory) */
export async function refreshLifeProductsAvailability(env, pageContent, loadGroupsByIds) {
  const groupIds = collectImportedGroupIds(pageContent);
  if (!groupIds.length) return pageContent;

  const groupsMap = await loadGroupsByIds(env, groupIds);
  if (!groupsMap.size) return pageContent;

  const fresh = JSON.parse(JSON.stringify(pageContent));
  refreshImportedProductsInContent(fresh, groupsMap);
  return fresh;
}

export function isPeptideOrInjectable(product) {
  const appType = String(product.system_data?.application_type || '').toLowerCase();
  if (appType.includes('inject')) return true;

  const text = productSearchText(product);
  return PEPTIDE_KEYWORDS.some((kw) => text.includes(kw));
}

export function isOralSupplement(product) {
  const appType = String(product.system_data?.application_type || 'Oral').toLowerCase();
  if (appType.includes('inject') || appType.includes('topical') || appType.includes('nasal')) {
    return false;
  }
  return !isPeptideOrInjectable(product);
}

export function isProductAvailable(product) {
  const inv = Number(product.system_data?.inventory ?? 0);
  if (inv <= 0) return false;

  const variants = product.public_data?.variants || [];
  if (!variants.length) return inv > 0;

  return variants.some((v) => v.available !== false && Number(v.price) > 0);
}

/** Минимална налична цена в EUR (каталогът на Life е в евро) */
export function getProductPriceEur(product) {
  const sale = product.public_data?.sale_price;
  const price = product.public_data?.price;
  const variants = (product.public_data?.variants || []).filter((v) => v.available !== false && v.price > 0);
  if (variants.length) return Math.min(...variants.map((v) => Number(v.price)));
  if (typeof sale === 'number' && sale > 0) return sale;
  return Number(price) || 0;
}

/** @deprecated използвайте getProductPriceEur */
export const getProductPriceBgn = getProductPriceEur;

export function filterEligibleProducts(products) {
  return products.filter((p) => isOralSupplement(p) && isProductAvailable(p));
}

export function buildClientProfile(raw) {
  const heightCm = Number(raw.height_cm) || 0;
  const weightKg = Number(raw.weight_kg) || 0;
  let bmi = null;
  if (heightCm > 0 && weightKg > 0) {
    const m = heightCm / 100;
    bmi = Math.round((weightKg / (m * m)) * 10) / 10;
  }

  const sex = raw.sex === 'male' ? 'male' : 'female';
  const ageBand = raw.age_band || '';
  const menopauseContext = sex === 'female' && ['45-54', '55-64', '65+'].includes(ageBand);

  const pickOther = (field) => String(raw[`${field}_other`] || '').trim();

  return {
    sex,
    age_band: ageBand,
    bmi,
    height_cm: heightCm,
    weight_kg: weightKg,
    priority: raw.priority || 'longevity',
    priority_other: pickOther('priority'),
    conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
    conditions_other: pickOther('conditions'),
    medications: Array.isArray(raw.medications) ? raw.medications : [],
    medications_other: pickOther('medications'),
    activity: raw.activity || 'rare',
    diet: raw.diet || 'omnivore',
    diet_other: pickOther('diet'),
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
    symptoms_other: pickOther('symptoms'),
    allergies: Array.isArray(raw.allergies) ? raw.allergies : [],
    allergies_other: pickOther('allergies'),
    pregnancy: raw.pregnancy || 'no',
    sun_exposure: raw.sun_exposure || null,
    joint_duration: raw.joint_duration || null,
    menopause_context: menopauseContext,
    email: String(raw.email || '').trim().toLowerCase(),
    name: String(raw.name || '').trim(),
  };
}

export function scoreProduct(product, profile) {
  const text = productSearchText(product);
  let score = 0;

  const priorityKws = PRIORITY_GOAL_KEYWORDS[profile.priority] || [];
  for (const kw of priorityKws) {
    if (text.includes(kw)) score += 3;
  }

  for (const symptom of profile.symptoms || []) {
    const kws = SYMPTOM_KEYWORDS[symptom] || [];
    for (const kw of kws) {
      if (text.includes(kw)) score += 2;
    }
  }

  if (profile.menopause_context) {
    if (productMatchesAnyKeyword(text, ['колаген', 'collagen', 'магнезий', 'magnesium', 'сън', 'sleep', 'dhea'])) {
      score += 2;
    }
  }

  if (profile.activity === 'regular') {
    if (productMatchesAnyKeyword(text, ['възстанов', 'recovery', 'магнезий', 'magnesium', 'колаген'])) {
      score += 1;
    }
  }

  const effects = product.public_data?.effects || [];
  const avgEffect = effects.length
    ? effects.reduce((s, e) => s + (Number(e.value) || 0), 0) / effects.length
    : 0;
  score += avgEffect / 40;

  return score;
}

export function buildCandidatePool(profile, products, { maxCandidates = 12 } = {}) {
  const excluded = new Map();
  const eligible = [];

  for (const product of products) {
    const reasons = getExclusionReasons(profile, product);
    if (reasons.length) {
      excluded.set(product.product_id, reasons);
      continue;
    }
    eligible.push({ product, score: scoreProduct(product, profile) });
  }

  eligible.sort((a, b) => b.score - a.score);
  const candidates = eligible.slice(0, maxCandidates).map((e) => e.product);

  const mustIncludeKws = getMustIncludeKeywords(profile);
  const candidateIds = new Set(candidates.map((p) => p.product_id));

  for (const product of products) {
    if (candidateIds.has(product.product_id)) continue;
    const text = productSearchText(product);
    if (mustIncludeKws.some((kw) => text.includes(kw))) {
      candidates.push(product);
      candidateIds.add(product.product_id);
    }
  }

  return {
    candidates,
    excluded_product_ids: Array.from(excluded.keys()),
    exclusion_map: Object.fromEntries(excluded),
  };
}

/** Ранкиране на всички eligible продукти — O(n), без горен лимит за compose-then-narrate */
export function rankEligibleProducts(profile, products) {
  const excluded = new Map();
  const ranked = [];

  for (const product of products) {
    const reasons = getExclusionReasons(profile, product);
    if (reasons.length) {
      excluded.set(product.product_id, reasons);
      continue;
    }
    ranked.push({ product, score: scoreProduct(product, profile) });
  }

  ranked.sort((a, b) => b.score - a.score);

  return {
    ranked,
    excluded_product_ids: Array.from(excluded.keys()),
    exclusion_map: Object.fromEntries(excluded),
  };
}

function getCheapestVariant(product) {
  const variants = (product.public_data?.variants || []).filter((v) => v.available !== false && v.price > 0);
  if (!variants.length) return null;
  return variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min));
}

export function enrichProtocolProductItem(item, product) {
  const priceEur = getProductPriceEur(product);
  const variant = getCheapestVariant(product);
  return {
    ...item,
    name: product.public_data?.name,
    brand: product.public_data?.brand,
    price_eur: Math.round(priceEur * 100) / 100,
    price_bgn: eurToBgn(priceEur),
    image_url: variant?.image_url || product.public_data?.image_url || '',
    variant_name: variant?.option_name || '',
    product_url: `life-product.html?id=${encodeURIComponent(product.product_id)}`,
  };
}

export function transformProductForAI(product) {
  const priceEur = getProductPriceEur(product);
  return {
    product_id: product.product_id,
    name: product.public_data?.name,
    price_eur: Math.round(priceEur * 100) / 100,
    goals: (product.system_data?.goals || []).slice(0, 3),
  };
}

/** Тематични групи за семантична дедупликация на ползи (без синонимно повторение) */
const BENEFIT_THEME_KEYWORDS = [
  { id: 'energy', keywords: ['енерги', 'умора', 'тонус', 'метабол', 'виталност', 'бодрост'] },
  { id: 'sleep', keywords: ['сън', 'нощ', 'възстанов', 'релакс', 'мелатонин'] },
  { id: 'skin', keywords: ['кож', 'еластич', 'колаген', 'антиейдж', 'бръчк', 'сияни'] },
  { id: 'immunity', keywords: ['имун', 'защит', 'инфекц', 'резистент'] },
  { id: 'cognition', keywords: ['когнитив', 'памет', 'фокус', 'концентрац', 'мозък', 'яснота'] },
  { id: 'cells', keywords: ['клетъч', 'оксидатив', 'антиоксидант', 'стрес', 'регенерац'] },
  { id: 'longevity', keywords: ['дълголет', 'антиейдж', 'подмлад', 'жизнен'] },
  { id: 'joints', keywords: ['став', 'подвиж', 'хрящ', 'скелет'] },
  { id: 'recovery', keywords: ['възстанов', 'рекур', 'мускул', 'натоварван', 'спорт'] },
  { id: 'hormones', keywords: ['хормон', 'щитовид', 'тестостерон', 'естроген'] },
  { id: 'digestion', keywords: ['храносмил', 'чрев', 'пробиот', 'стомах'] },
  { id: 'heart', keywords: ['сърдеч', 'съдов', 'холестерол', 'кръвн'] },
];

function normalizeBenefitText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBenefitThemes(text) {
  const normalized = normalizeBenefitText(text);
  const themes = new Set();
  for (const { id, keywords } of BENEFIT_THEME_KEYWORDS) {
    if (keywords.some((kw) => normalized.includes(kw))) themes.add(id);
  }
  if (!themes.size) themes.add('general');
  return themes;
}

export function isBenefitSemanticallySimilar(a, b) {
  const left = normalizeBenefitText(a);
  const right = normalizeBenefitText(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const themesA = getBenefitThemes(left);
  const themesB = getBenefitThemes(right);
  for (const theme of themesA) {
    if (theme !== 'general' && themesB.has(theme)) return true;
  }

  const wordsA = new Set(left.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(right.split(' ').filter((w) => w.length > 3));
  if (!wordsA.size || !wordsB.size) return false;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap += 1;
  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap / minSize >= 0.45;
}

export function filterNovelBenefits(candidates, existing = []) {
  const accepted = [...existing];
  const novel = [];
  for (const benefit of candidates || []) {
    const text = String(benefit).trim();
    if (!text) continue;
    if (accepted.some((e) => isBenefitSemanticallySimilar(e, text))) continue;
    novel.push(text);
    accepted.push(text);
  }
  return novel;
}

const DEFAULT_BASIC_BENEFITS = [
  'Подкрепя ежедневната енергия',
  'Укрепва имунната защита',
  'Защитава клетките от оксидативен стрес',
];

const DEFAULT_OPTIMAL_ADDITIONS = [
  'Подобрява качеството на съня',
  'Подпомага възстановяването след натоварване',
  'Подкрепя кожата отвътре',
];

const DEFAULT_PREMIUM_ADDITIONS = [
  'Стимулира клетъчната регенерация',
  'Подобрява когнитивната острота и фокуса',
  'Максимална антиейджинг защита',
  'Пълна подкрепа за дълголетие',
];

export function buildCumulativeBenefitTiers(tiers) {
  const dedupe = (arr) => [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))];

  const basicPool = dedupe(tiers?.basic?.benefits);
  const basicFinal = (basicPool.length ? filterNovelBenefits(basicPool) : DEFAULT_BASIC_BENEFITS).slice(0, 4);

  const optimalPool = dedupe(tiers?.optimal?.benefits);
  const optimalAdd = filterNovelBenefits(optimalPool, basicFinal);
  const optimalFinal = [
    ...basicFinal,
    ...(optimalAdd.length ? optimalAdd : filterNovelBenefits(DEFAULT_OPTIMAL_ADDITIONS, basicFinal)).slice(0, 3),
  ];

  const premiumPool = dedupe(tiers?.premium?.benefits);
  const premiumAdd = filterNovelBenefits(premiumPool, optimalFinal);
  const premiumFinal = [
    ...optimalFinal,
    ...(premiumAdd.length ? premiumAdd : filterNovelBenefits(DEFAULT_PREMIUM_ADDITIONS, optimalFinal)).slice(0, 4),
  ];

  return {
    basic: { list: basicFinal, inherited: 0 },
    optimal: { list: optimalFinal, inherited: basicFinal.length },
    premium: { list: premiumFinal, inherited: optimalFinal.length },
  };
}

export function normalizeCumulativeBenefits(response) {
  const tiers = response?.tiers;
  if (!tiers?.basic || !tiers?.optimal || !tiers?.premium) return response;

  const built = buildCumulativeBenefitTiers(tiers);
  tiers.basic.benefits = built.basic.list;
  tiers.optimal.benefits = built.optimal.list;
  tiers.premium.benefits = built.premium.list;

  return response;
}

export function validateProtocolResponse(response, candidates, excludedProductIds = []) {
  const validIds = new Set(candidates.map((p) => p.product_id));
  const excluded = new Set(excludedProductIds);
  const productMap = new Map(candidates.map((p) => [p.product_id, p]));

  if (!response?.tiers?.basic || !response?.tiers?.optimal || !response?.tiers?.premium) {
    throw new Error('Липсват трите ценови класа в AI отговора.');
  }

  const tierKeys = ['basic', 'optimal', 'premium'];
  for (const key of tierKeys) {
    const tier = response.tiers[key];
    if (!Array.isArray(tier.products) || !tier.products.length) {
      throw new Error(`Tier "${key}" няма продукти.`);
    }
    for (const item of tier.products) {
      const pid = item.product_id;
      if (!validIds.has(pid)) throw new Error(`Невалиден product_id: ${pid}`);
      if (excluded.has(pid)) throw new Error(`Изключен продукт в стака: ${pid}`);
    }
    tier.products = tier.products.map((item) => enrichProtocolProductItem(item, productMap.get(item.product_id)));
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

/** Обогатява и финализира отговор с фиксирани product_id (compose-then-narrate) */
export function finalizeProtocolResponse(response, eligibleProducts, excludedProductIds = []) {
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
    tier.products = tier.products.map((item) => enrichProtocolProductItem(item, productMap.get(item.product_id)));
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

export async function prepareProtocolSubmission(env, rawAnswers, deps, { compositionMode = 'compose_narrate' } = {}) {
  const profile = buildClientProfile(rawAnswers);
  if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    throw new Error('Невалиден имейл адрес.');
  }
  if (!profile.priority) throw new Error('Липсва основен приоритет.');

  let content = await deps.loadProjectContent(env, 'life');
  content = await refreshLifeProductsAvailability(env, content, deps.loadGroupsByIds);

  const allProducts = extractProductsFromContent(content);
  const eligible = filterEligibleProducts(allProducts);

  if (eligible.length < 3) {
    throw new Error('Няма достатъчно налични орални продукти за персонален протокол. Моля, опитайте по-късно.');
  }

  const rankedResult = rankEligibleProducts(profile, eligible);

  if (rankedResult.ranked.length < 3) {
    throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
  }

  const mustIncludeKws = getMustIncludeKeywords(profile);

  if (compositionMode === 'ai_pick') {
    const { candidates, excluded_product_ids, exclusion_map } = buildCandidatePool(profile, eligible);
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
        oral_only: true,
        price_ceiling_eur: { basic_target: 25, premium_max: 100 },
        tier_product_counts: { basic: '3-4', optimal: '5-6', premium: '6-8' },
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
      content,
    };
  }

  const payload = {
    client_profile: profile,
    priority_summary: profile.priority,
    composition_mode: 'compose_narrate',
    constraints: {
      excluded_product_ids: rankedResult.excluded_product_ids,
      must_include_keywords: mustIncludeKws,
      oral_only: true,
      price_ceiling_eur: { basic_target: 25, premium_max: 100 },
      tier_product_counts: { basic: '3-4', optimal: '5-6', premium: '6-8' },
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
    content,
  };
}

/**
 * @param {unknown} candidatesOrRanked
 * @param {object} profile
 * @param {{ ranked?: { product: object, score: number }[] }} [options]
 */
export function buildMockProtocolResponse(candidatesOrRanked, profile, options = {}) {
  const { ranked } = options;

  /** @type {{ product: object, score: number }[]} */
  let rankedEntries = ranked || [];

  if (!ranked) {
    if (Array.isArray(candidatesOrRanked) && candidatesOrRanked[0]?.product) {
      rankedEntries = candidatesOrRanked;
    } else {
      const candidates = Array.isArray(candidatesOrRanked) ? candidatesOrRanked : [];
      rankedEntries = candidates.map((product) => ({ product, score: 0 }));
    }
  }

  const composed = composeProtocolStacks(profile, rankedEntries);
  const narration = buildMockNarration(composed, profile);
  const eligible = rankedEntries.map((e) => e.product);
  const productMap = new Map(eligible.map((p) => [p.product_id, p]));
  const { response } = assembleProtocolFromComposition(composed, narration, productMap, []);
  return finalizeProtocolResponse(response, eligible, []);
}
