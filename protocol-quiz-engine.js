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

export function normalizeCumulativeBenefits(response) {
  const tiers = response?.tiers;
  if (!tiers?.basic || !tiers?.optimal || !tiers?.premium) return response;

  const dedupe = (arr) => [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))];

  const defaultBasic = [
    'Подкрепя ежедневната енергия',
    'Укрепва имунната защита',
    'Защитава клетките от оксидативен стрес',
  ];
  const defaultOptimalAdd = [
    'Подобрява качеството на съня',
    'Подпомага възстановяването след натоварване',
    'Подкрепя кожата отвътре',
  ];
  const defaultPremiumAdd = [
    'Стимулира клетъчната регенерация',
    'Подобрява когнитивната острота и фокуса',
    'Максимална антиейджинг защита',
    'Пълна подкрепа за дълголетие',
  ];

  const basic = dedupe(tiers.basic.benefits);
  const basicFinal = (basic.length ? basic : defaultBasic).slice(0, 4);

  const optimalRaw = dedupe(tiers.optimal.benefits);
  const optimalAdd = optimalRaw.filter((b) => !basicFinal.includes(b));
  const optimalFinal = [...basicFinal, ...(optimalAdd.length ? optimalAdd : defaultOptimalAdd).slice(0, 3)];

  const premiumRaw = dedupe(tiers.premium.benefits);
  const premiumAdd = premiumRaw.filter((b) => !optimalFinal.includes(b));
  const premiumFinal = [...optimalFinal, ...(premiumAdd.length ? premiumAdd : defaultPremiumAdd).slice(0, 4)];

  tiers.basic.benefits = basicFinal;
  tiers.optimal.benefits = optimalFinal;
  tiers.premium.benefits = premiumFinal;

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

export async function prepareProtocolSubmission(env, rawAnswers, deps) {
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

  const { candidates, excluded_product_ids, exclusion_map } = buildCandidatePool(profile, eligible);

  if (candidates.length < 3) {
    throw new Error('Няма достатъчно подходящи продукти след safety филтъра. Опитайте с по-общ профил.');
  }
  const mustIncludeKws = getMustIncludeKeywords(profile);

  const payload = {
    client_profile: profile,
    priority_summary: profile.priority,
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
      candidates_sent_to_ai: candidates.length,
    },
  };

  return { profile, payload, candidates, content };
}

/** Детерминистичен mock отговор за тестове/E2E без AI */
export function buildMockProtocolResponse(candidates, profile) {
  const slice = (start, count) => candidates.slice(start, start + count);
  const mkProducts = (items) => items.map((p, i) => ({
    product_id: p.product_id,
    name: p.public_data?.name,
    role: i === 0 ? 'core' : 'support',
    dose: 'Според етикета',
    timing: i % 2 === 0 ? 'сутрин с храна' : 'вечер',
    why_for_you: `Подходящ за приоритет „${profile.priority}"`,
    marketing_angle: 'Тестова препоръка',
    price_eur: Math.round(getProductPriceEur(p) * 100) / 100,
    price_bgn: eurToBgn(getProductPriceEur(p)),
    image_url: p.public_data?.image_url || '',
    variant_name: getCheapestVariant(p)?.option_name || '',
    product_url: `life-product.html?id=${encodeURIComponent(p.product_id)}`,
  }));

  const mkTier = (key, name, tagline, items, benefits) => {
    const products = mkProducts(items);
    const totalEur = products.reduce((s, x) => s + (x.price_eur || 0), 0);
    return {
      name,
      tagline,
      monthly_total_eur: Math.round(totalEur * 100) / 100,
      monthly_total_bgn: eurToBgn(totalEur),
      benefits,
      strategy: `Стратегия за ${name.toLowerCase()} — фокус върху ${profile.priority}`,
      expected_timeline: 'Първи ефекти: 3–4 седмици',
      products,
    };
  };

  const basicItems = slice(0, Math.min(3, candidates.length));
  const optimalItems = slice(0, Math.min(5, candidates.length));
  const premiumItems = slice(0, Math.min(7, candidates.length));

  const response = {
    analysis: `Профилът ви показва фокус върху ${profile.priority}. Подготвихме три варианта от наличните орални добавки.`,
    recommended_tier: 'optimal',
    tiers: {
      basic: mkTier('basic', 'Базов старт', 'Минимален ефективен протокол', basicItems, [
        'Подкрепя ежедневната енергия',
        'Укрепва имунната защита',
        'Защитава клетките от оксидативен стрес',
      ]),
      optimal: mkTier('optimal', 'Оптимален протокол', 'Най-добра стойност', optimalItems, [
        'Подкрепя ежедневната енергия',
        'Укрепва имунната защита',
        'Защитава клетките от оксидативен стрес',
        'Подобрява качеството на съня',
        'Подпомага възстановяването след натоварване',
        'Подкрепя кожата отвътре',
      ]),
      premium: mkTier('premium', 'Премиум регенерация', 'Пълен клетъчен протокол', premiumItems, [
        'Подкрепя ежедневната енергия',
        'Укрепва имунната защита',
        'Защитава клетките от оксидативен стрес',
        'Подобрява качеството на съня',
        'Подпомага възстановяването след натоварване',
        'Подкрепя кожата отвътре',
        'Стимулира клетъчната регенерация',
        'Подобрява когнитивната острота и фокуса',
        'Максимална антиейджинг защита',
        'Пълна подкрепа за дълголетие',
      ]),
    },
    protocol_schedule: {
      morning: ['Основните добавки със закуска'],
      evening: ['Поддържащи добавки преди сън'],
      weekly_notes: 'Пийте достатъчно вода и поддържайте редовен режим.',
    },
    lifestyle_tips: ['Движение 30 мин дневно', '7–8 часа сън', 'Балансирана храна'],
    disclaimer: 'Информацията не замества лекарска консултация.',
  };

  return validateProtocolResponse(response, candidates, []);
}
