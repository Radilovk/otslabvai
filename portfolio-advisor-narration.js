/**
 * Narration за Portfolio AI консултант — независими tier съвети (single и package).
 */

import { buildMockNarration } from './protocol-stack-composer.js';

const TIER_LABELS = {
  basic: { price: 'достъпна', focus: 'добра стойност', scope: 'стартов' },
  optimal: { price: 'оптимална', focus: 'най-добро съответствие', scope: 'балансиран' },
  premium: { price: 'премиум', focus: 'топ формула', scope: 'разширен' },
};

const SLOT_ROLE_LABELS = {
  core: 'основен',
  support: 'допълващ',
  foundation: 'базов',
};

function productDisplayName(product, item) {
  return product?.public_data?.name || item?.product_id || 'Продуктът';
}

function buildSingleProductSchedule(item, name) {
  const dose = item?.dose || 'според етикета';
  const timing = String(item?.timing || 'сутрин').toLowerCase();
  const line = `${name} — ${dose}`;
  const schedule = { morning: [], midday: [], evening: [], weekly_notes: '' };

  if (timing.includes('вечер') || timing.includes('нощ')) {
    schedule.evening = [line];
  } else if (timing.includes('обед') || timing.includes('следобед')) {
    schedule.midday = [line];
  } else {
    schedule.morning = [line];
  }

  schedule.weekly_notes = `Приемайте ${name} редовно, според указанията на етикета.`;
  return schedule;
}

function buildPackageTierSchedule(products, productMap) {
  const schedule = { morning: [], midday: [], evening: [], weekly_notes: '' };

  for (const item of products) {
    const product = productMap.get(item.product_id);
    const name = productDisplayName(product, item);
    const dose = item.dose || 'според етикета';
    const timing = String(item.timing || 'сутрин').toLowerCase();
    const line = `${name} — ${dose}`;

    if (timing.includes('вечер') || timing.includes('нощ') || timing.includes('сън')) {
      schedule.evening.push(line);
    } else if (timing.includes('обед') || timing.includes('следобед') || timing.includes('тренировка')) {
      schedule.midday.push(line);
    } else {
      schedule.morning.push(line);
    }
  }

  schedule.weekly_notes = 'Всяка добавка се приема по етикета — не удвоявайте дози и не комбинирайте продукти с еднакви активни вещества.';
  return schedule;
}

function buildPackageTierNarration(tierKey, tier, profile, productMap) {
  const priority = profile.priority_other || profile.priority || 'здраве';
  const labels = TIER_LABELS[tierKey];
  const products = tier.products || [];

  const roles = products.map((item) => {
    const product = productMap.get(item.product_id);
    const name = productDisplayName(product, item);
    const roleLabel = SLOT_ROLE_LABELS[item.role] || 'допълващ';
    return `${name} (${roleLabel})`;
  });

  return {
    benefits: [
      `${labels.scope.charAt(0).toUpperCase() + labels.scope.slice(1)} пакет за „${priority}"`,
      'Комплементарни продукти — всеки с различна роля',
      'Без дублиране на активни вещества в един прием',
      ...roles.slice(0, 2).map((r) => `Включва: ${r}`),
    ].slice(0, 5),
    strategy: `${labels.scope.charAt(0).toUpperCase() + labels.scope.slice(1)} комбинация от ${products.length} допълващи се продукта. Всеки артикул покрива различен аспект — не увеличавайте дозите на етикета.`,
  };
}

export function buildPortfolioAdvisorNarration(composed, profile, productMap = new Map()) {
  if (profile.selection_mode !== 'single' && composed.meta?.mode !== 'complementary_independent') {
    return buildMockNarration(composed, profile);
  }

  const priority = profile.priority_other || profile.priority || 'здраве';
  const tier_copy = {};
  const product_copy = {};
  const tier_schedules = {};
  const isSingle = profile.selection_mode === 'single';

  for (const key of ['basic', 'optimal', 'premium']) {
    const tier = composed.tiers[key];
    const products = tier?.products || [];

    if (isSingle) {
      const item = products[0];
      const product = item ? productMap.get(item.product_id) : null;
      const name = productDisplayName(product, item);
      const labels = TIER_LABELS[key];

      tier_copy[key] = {
        benefits: [
          `${name} — подходящ за цел „${priority}"`,
          labels.focus.charAt(0).toUpperCase() + labels.focus.slice(1),
          'Самостоятелен продукт — без комбиниране с други артикули',
        ],
        strategy: `${name} на ${labels.price} цена — фокус върху един продукт, съобразен с профила ви.`,
      };

      if (item) {
        product_copy[item.product_id] = {
          why_for_you: `Избран за „${priority}" — ${name}`,
          dose: item.dose || 'Според етикета',
          timing: item.timing || 'сутрин с храна',
        };
        tier_schedules[key] = buildSingleProductSchedule(item, name);
      }
    } else {
      tier_copy[key] = buildPackageTierNarration(key, tier, profile, productMap);
      tier_schedules[key] = buildPackageTierSchedule(products, productMap);

      for (const item of products) {
        const product = productMap.get(item.product_id);
        const name = productDisplayName(product, item);
        const roleLabel = SLOT_ROLE_LABELS[item.role] || 'допълващ';
        product_copy[item.product_id] = {
          why_for_you: `${roleLabel} продукт за „${priority}" — ${name}`,
          dose: item.dose || 'Според етикета',
          timing: item.timing || 'сутрин с храна',
        };
      }
    }
  }

  const recommended = composed.recommended_tier || 'optimal';

  return {
    analysis: isSingle
      ? `Подготвихме три различни продукта за цел „${priority}". Всеки вариант е самостоятелен — без пакет от няколко артикула.`
      : `Съставихме три независими комплементарни пакета за „${priority}". Всеки tier използва различни продукти с различни роли — без повтарящи се активни вещества.`,
    recommended_tier: recommended,
    tier_copy,
    product_copy,
    tier_schedules,
    protocol_schedule: tier_schedules[recommended] || {
      morning: ['Прием според етикета на всеки продукт'],
      weekly_notes: 'Не комбинирайте продукти с еднакви активни вещества. Следвайте дозировката на етикета.',
    },
    lifestyle_tips: [
      'Комбинирайте добавките с балансирано хранене',
      'Пийте достатъчно вода през деня',
      'Не удвоявайте дози — всеки продукт се приема по етикета',
      'При хронични заболявания се консултирайте с лекар',
    ],
    disclaimer: 'Информацията не замества лекарска консултация. Не надвишавайте препоръчителните дози на етикета.',
  };
}
