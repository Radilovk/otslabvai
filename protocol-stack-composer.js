/**
 * Compose-then-Narrate: детерминистично съставяне на 3-tier стекове
 * от целия наличен каталог (мащабира до стотици продукти).
 * AI не избира product_id — само генерира текст върху фиксирани стекове.
 */

import {
  getMustIncludeKeywords,
  productMatchesAnyKeyword,
  productSearchText,
} from './protocol-safety-rules.js';
import { getProductPriceEur } from './protocol-quiz-engine.js';

const TIER_LIMITS = {
  basic: { min: 3, max: 4, budgetEur: 32 },
  optimal: { min: 5, max: 6, budgetEur: 68 },
  premium: { min: 6, max: 8, budgetEur: 105 },
};

const TIER_META = {
  basic: { name: 'Базов старт', tagline: 'Минимален ефективен протокол' },
  optimal: { name: 'Оптимален протокол', tagline: 'Най-добра стойност за профила' },
  premium: { name: 'Премиум регенерация', tagline: 'Пълен клетъчен протокол' },
};

function productGoalKey(product) {
  const goals = product.system_data?.goals || [];
  if (goals.length) return goals[0];
  const text = productSearchText(product);
  if (text.includes('сън') || text.includes('sleep')) return 'sleep';
  if (text.includes('кож') || text.includes('skin')) return 'skin';
  if (text.includes('став') || text.includes('joint')) return 'joints';
  if (text.includes('енерги') || text.includes('energy')) return 'energy';
  return product.product_id;
}

function toStackItem(product, index) {
  return {
    product_id: product.product_id,
    role: index === 0 ? 'core' : 'support',
    dose: 'Според етикета',
    timing: index % 2 === 0 ? 'сутрин с храна' : 'вечер',
  };
}

function findMustIncludeProducts(profile, ranked) {
  const keywords = getMustIncludeKeywords(profile);
  if (!keywords.length) return [];

  const found = [];
  const seen = new Set();
  for (const { product } of ranked) {
    const text = productSearchText(product);
    if (keywords.some((kw) => productMatchesAnyKeyword(text, [kw])) && !seen.has(product.product_id)) {
      found.push(product);
      seen.add(product.product_id);
    }
  }
  return found;
}

function pickProducts(ranked, { count, budgetEur, picked, diversify = true }) {
  const selected = [];
  const usedGoals = new Set();
  let totalEur = 0;

  const tryPick = (entry, force = false) => {
    const { product } = entry;
    if (picked.has(product.product_id)) return false;
    const price = getProductPriceEur(product);
    if (!force && selected.length >= 3 && totalEur + price > budgetEur) return false;

    const goalKey = productGoalKey(product);
    if (diversify && selected.length < count && usedGoals.has(goalKey) && selected.length < count - 1) {
      return false;
    }

    selected.push(product);
    picked.add(product.product_id);
    usedGoals.add(goalKey);
    totalEur += price;
    return true;
  };

  for (const entry of ranked) {
    if (selected.length >= count) break;
    tryPick(entry);
  }

  if (selected.length < count) {
    for (const entry of ranked) {
      if (selected.length >= count) break;
      tryPick(entry, true);
    }
  }

  return selected;
}

function buildTierProducts(products) {
  return products.map((product, index) => toStackItem(product, index));
}

/**
 * Кумулативни стекове: basic ⊂ optimal ⊂ premium
 * Сканира целия ranked pool (стотици продукти).
 */
export function composeProtocolStacks(profile, rankedEntries) {
  const picked = new Set();
  const mustInclude = findMustIncludeProducts(profile, rankedEntries);

  for (const product of mustInclude) {
    picked.add(product.product_id);
  }

  const basicCore = [
    ...mustInclude,
    ...pickProducts(rankedEntries, {
      count: TIER_LIMITS.basic.max,
      budgetEur: TIER_LIMITS.basic.budgetEur,
      picked,
    }),
  ].slice(0, TIER_LIMITS.basic.max);

  for (const p of basicCore) picked.add(p.product_id);

  const optimalExtra = pickProducts(rankedEntries, {
    count: Math.max(0, TIER_LIMITS.optimal.max - basicCore.length),
    budgetEur: TIER_LIMITS.optimal.budgetEur,
    picked,
  });
  const optimalProducts = [...basicCore, ...optimalExtra].slice(0, TIER_LIMITS.optimal.max);

  for (const p of optimalProducts) picked.add(p.product_id);

  const premiumExtra = pickProducts(rankedEntries, {
    count: Math.max(0, TIER_LIMITS.premium.max - optimalProducts.length),
    budgetEur: TIER_LIMITS.premium.budgetEur,
    picked,
  });
  const premiumProducts = [...optimalProducts, ...premiumExtra].slice(0, TIER_LIMITS.premium.max);

  const tiers = {
    basic: {
      ...TIER_META.basic,
      products: buildTierProducts(basicCore),
    },
    optimal: {
      ...TIER_META.optimal,
      products: buildTierProducts(optimalProducts),
    },
    premium: {
      ...TIER_META.premium,
      products: buildTierProducts(premiumProducts),
    },
  };

  return {
    recommended_tier: 'optimal',
    tiers,
    meta: {
      ranked_pool_size: rankedEntries.length,
      must_include_count: mustInclude.length,
      tier_counts: {
        basic: tiers.basic.products.length,
        optimal: tiers.optimal.products.length,
        premium: tiers.premium.products.length,
      },
    },
  };
}

/** Слива AI narration с детерминистично съставените стекове */
export function assembleProtocolFromComposition(composed, narration, productMap, excludedProductIds = []) {
  const tierKeys = ['basic', 'optimal', 'premium'];
  const tiers = {};

  for (const key of tierKeys) {
    const base = composed.tiers[key];
    const copy = narration?.tier_copy?.[key] || {};
    const products = (base.products || []).map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Липсва продукт в каталога: ${item.product_id}`);
      const aiItem = narration?.product_copy?.[item.product_id] || {};
      return {
        ...item,
        dose: aiItem.dose || item.dose,
        timing: aiItem.timing || item.timing,
        why_for_you: aiItem.why_for_you || '',
      };
    });

    tiers[key] = {
      name: copy.name || base.name,
      tagline: copy.tagline || base.tagline,
      strategy: copy.strategy || '',
      benefits: Array.isArray(copy.benefits) ? copy.benefits : [],
      products,
    };
  }

  const response = {
    analysis: narration?.analysis || '',
    recommended_tier: ['basic', 'optimal', 'premium'].includes(narration?.recommended_tier)
      ? narration.recommended_tier
      : composed.recommended_tier || 'optimal',
    tiers,
    protocol_schedule: narration?.protocol_schedule || {
      morning: ['Основните добавки със закуска'],
      evening: ['Поддържащи добавки преди сън'],
      weekly_notes: 'Поддържайте редовен режим и достатъчна хидратация.',
    },
    lifestyle_tips: Array.isArray(narration?.lifestyle_tips) ? narration.lifestyle_tips : [],
    disclaimer: narration?.disclaimer || 'Информацията не замества лекарска консултация.',
  };

  const candidates = [...productMap.values()];
  return { response, candidates, excludedProductIds };
}

/** Детерминистична narration за mock / fallback */
export function buildMockNarration(composed, profile) {
  const priority = profile.priority_other || profile.priority || 'здраве';
  const tierBenefits = {
    basic: [
      'Подкрепя ежедневната енергия',
      'Укрепва имунната защита',
      'Защитава клетките от оксидативен стрес',
    ],
    optimal: [
      'Подкрепя ежедневната енергия',
      'Укрепва имунната защита',
      'Защитава клетките от оксидативен стрес',
      'Подобрява качеството на съня',
      'Подпомага възстановяването след натоварване',
      'Подкрепя кожата отвътре',
    ],
    premium: [
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
    ],
  };

  const product_copy = {};
  for (const key of ['basic', 'optimal', 'premium']) {
    for (const item of composed.tiers[key].products) {
      product_copy[item.product_id] = {
        why_for_you: `Подкрепя приоритет „${priority}"`,
        dose: item.dose,
        timing: item.timing,
      };
    }
  }

  return {
    analysis: `Профилът ви показва фокус върху ${priority}. Сканирахме ${composed.meta?.ranked_pool_size || 0} налични продукта и съставихме три оптимални стека.`,
    recommended_tier: composed.recommended_tier || 'optimal',
    tier_copy: {
      basic: { benefits: tierBenefits.basic, strategy: 'Базов протокол с фокус върху ежедневната подкрепа.' },
      optimal: { benefits: tierBenefits.optimal, strategy: 'Балансиран стек с по-широко покритие на целите.' },
      premium: { benefits: tierBenefits.premium, strategy: 'Максимално покритие и клетъчна подкрепа.' },
    },
    product_copy,
    protocol_schedule: {
      morning: ['Основните добавки със закуска'],
      evening: ['Поддържащи добавки преди сън'],
      weekly_notes: 'Пийте достатъчно вода и поддържайте редовен режим.',
    },
    lifestyle_tips: ['Движение 30 мин дневно', '7–8 часа сън', 'Балансирана храна'],
    disclaimer: 'Информацията не замества лекарска консултация.',
  };
}
