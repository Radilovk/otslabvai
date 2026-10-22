/**
 * Compose-then-Narrate: детерминистично съставяне на 3-tier стекове
 * от целия наличен каталог (мащабира до стотици продукти).
 * AI не избира product_id — само генерира текст върху фиксирани стекове.
 */

import { composeAdvisorStacks } from './advisor-composer.js';
import { getProductFacts } from './advisor-product-facts.js';

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

/**
 * Кумулативни стекове basic ⊂ optimal ⊂ premium по плана от слотове за приоритета на профила.
 * (Обвивка за съвместимост — логиката е в advisor-composer.js.)
 */
export function composeProtocolStacks(profile, rankedEntries, options = {}) {
  return composeAdvisorStacks(profile, rankedEntries, {
    tierLimits: options.tierLimits || TIER_LIMITS,
    tierMeta: options.tierMeta || TIER_META,
    goal: options.goal || profile.priority || 'longevity',
    siteId: options.siteId || 'life',
  });
}

/** Основен продукт за отслабване (бърнър, метаболизъм, апетит). */
export function isWeightLossCoreProduct(product) {
  return ['fat_burner', 'fat_burner_nonstim', 'appetite', 'carnitine', 'cla', 'glucose'].includes(getProductFacts(product).slot);
}

/**
 * daotslabna: основен продукт за отслабване + подкрепа по плана „отслабване“.
 * Без нито един продукт за отслабване → null (тогава се ползва общият композитор).
 */
export function composeCoreSupportStacks(profile, rankedEntries, options = {}) {
  if (!rankedEntries.some(({ product }) => isWeightLossCoreProduct(product))) return null;
  return composeAdvisorStacks(profile, rankedEntries, {
    tierLimits: options.tierLimits || TIER_LIMITS,
    tierMeta: options.tierMeta || TIER_META,
    goal: 'otshalvane',
    siteId: 'main',
  });
}

/** Слива AI narration с детерминистично съставените стекове */
export function assembleProtocolFromComposition(composed, narration, productMap, excludedProductIds = []) {
  const tierKeys = ['basic', 'optimal', 'premium'];
  const tiers = {};
  const tierSchedules = narration?.tier_schedules || null;

  for (const key of tierKeys) {
    const base = composed.tiers[key];
    const copy = narration?.tier_copy?.[key] || {};
    const products = (base.products || []).map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Липсва продукт в каталога: ${item.product_id}`);
      const aiItem = narration?.product_copy?.[item.product_id] || {};
      return {
        ...item,
        // Дозата и часът — от кода (етикет / роля); AI пише само „защо за вас“.
        dose: item.dose,
        timing: item.timing,
        why_for_you: aiItem.why_for_you || '',
      };
    });

    tiers[key] = {
      name: copy.name || base.name,
      tagline: copy.tagline || base.tagline,
      strategy: copy.strategy || '',
      benefits: Array.isArray(copy.benefits) ? copy.benefits : [],
      products,
      ...(tierSchedules?.[key] ? { schedule: tierSchedules[key] } : {}),
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


/** Кратка, честна полза на слот (без медицински обещания) — за резервния текст без AI. */
const SLOT_BENEFITS = {
  fat_burner: 'Подкрепа на енергийния разход',
  fat_burner_nonstim: 'Подкрепа на метаболизма на мазнините без стимуланти',
  carnitine: 'Подкрепа на използването на мазнини за енергия',
  cla: 'Подкрепа на телесната композиция',
  appetite: 'По-лесен контрол на апетита',
  glucose: 'По-стабилна кръвна захар между храненията',
  diuretic: 'Намалява задържането на вода',
  caffeine: 'Енергия и концентрация',
  preworkout: 'Повече енергия за тренировката',
  pump: 'По-добро кръвоснабдяване на мускулите при тренировка',
  protein: 'Ситост и запазване на мускулите',
  meal: 'Лесно контролирано хранене',
  gainer: 'Допълнителни калории за покачване на тегло',
  carbs: 'Енергия по време на натоварване',
  creatine: 'Сила и мощност при тренировка',
  aminos: 'По-бързо възстановяване на мускулите',
  electrolytes: 'Хидратация при натоварване',
  multivitamin: 'Покрива основните витамини и минерали',
  vitamin_d: 'Подкрепа на имунитета, костите и мускулите',
  vitamin_c: 'Подкрепа на имунитета',
  b_complex: 'Подкрепа на енергийния метаболизъм',
  vitamins: 'Допълва хранителния прием на витамини',
  magnesium: 'По-спокоен сън и по-малко крампи',
  iron: 'Подкрепа при умора, свързана с ниско желязо',
  minerals: 'Допълва минералите в храненето',
  omega3: 'Подкрепа на сърцето и мозъка',
  mct: 'Бърз източник на енергия',
  collagen: 'Подкрепа на кожата и съединителната тъкан',
  beauty: 'Подкрепа на косата, кожата и ноктите',
  joint: 'Подкрепа на ставите и подвижността',
  coq10: 'Клетъчна енергия',
  antioxidant: 'Защита от оксидативен стрес',
  longevity: 'Клетъчна енергия и регенерация',
  adaptogen: 'По-добра устойчивост на стрес',
  sleep: 'По-лесно заспиване и по-качествен сън',
  cognition: 'Подкрепа на фокуса и паметта',
  gut: 'Подкрепа на храносмилането',
  immune: 'Подкрепа на имунната система',
  liver: 'Подкрепа на черния дроб',
  heart: 'Подкрепа на сърдечно-съдовата система',
  hormone_male: 'Подкрепа на мъжкия хормонален баланс',
  womens: 'Подкрепа на женския хормонален баланс',
  mens: 'Подкрепа на мъжкото здраве',
};

const PRIORITY_LABELS_BG = {
  longevity: 'антиейджинг',
  antiaging: 'антиейджинг',
  otshalvane: 'отслабване',
  skin: 'кожа',
  joints: 'стави',
  energy: 'енергия',
  sleep: 'сън',
  cognition: 'фокус и памет',
  muscle: 'мускулна маса',
  health: 'здраве и имунитет',
  recovery: 'възстановяване',
};

function itemSlot(item, productMap) {
  if (item.slot) return item.slot;
  const product = productMap?.get?.(item.product_id);
  return product ? getProductFacts(product).slot : 'other';
}

/** Детерминистична narration за mock / fallback — ползите идват от слотовете в пакета. */
export function buildMockNarration(composed, profile, productMap = null) {
  const priority = profile.priority_other || PRIORITY_LABELS_BG[profile.priority] || profile.priority || 'здраве';
  const product_copy = {};
  const tier_copy = {};
  for (const key of ['basic', 'optimal', 'premium']) {
    const items = composed.tiers[key].products;
    const benefits = [...new Set(items.map((i) => SLOT_BENEFITS[itemSlot(i, productMap)]).filter(Boolean))];
    tier_copy[key] = {
      benefits,
      strategy: composed.meta?.mode === 'alternatives'
        ? 'Един основен продукт — различна цена и формула.'
        : `${items.length} ${items.length === 1 ? 'продукт' : 'продукта'} с различни роли, без дублиране на активни вещества.`,
    };
    for (const item of items) {
      const slot = itemSlot(item, productMap);
      product_copy[item.product_id] = {
        why_for_you: SLOT_BENEFITS[slot] || `Подкрепя приоритет „${priority}“`,
        dose: item.dose,
        timing: item.timing,
      };
    }
  }

  const morning = [];
  const evening = [];
  for (const item of composed.tiers.premium.products) {
    (/вечер|сън/.test(item.timing || '') ? evening : morning).push(item.timing);
  }

  return {
    analysis: `Профилът ви е насочен към: ${priority}. Подбрахме продукти с допълващи се роли от ${composed.meta?.ranked_pool_size || 0} подходящи за вас.`,
    recommended_tier: composed.recommended_tier || 'optimal',
    tier_copy,
    product_copy,
    protocol_schedule: {
      morning: morning.length ? ['Сутрешните продукти — със закуска или преди тренировка'] : [],
      evening: evening.length ? ['Вечерните продукти — 30–60 мин преди сън'] : [],
      weekly_notes: 'Приемайте всеки ден поне 4–6 седмици, преди да оцените ефекта.',
    },
    lifestyle_tips: profile.priority === 'otshalvane'
      ? ['Умерен калориен дефицит — добавките не го заместват', 'Протеин на всяко хранене', '7–8 часа сън']
      : ['Движение поне 30 мин дневно', '7–8 часа сън', 'Разнообразно хранене'],
    disclaimer: 'Информацията не замества лекарска консултация.',
  };
}
