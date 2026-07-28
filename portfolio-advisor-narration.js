/**
 * Narration за Portfolio AI консултант — single mode с независими tier съвети.
 */

import { buildMockNarration } from './protocol-stack-composer.js';

const TIER_LABELS = {
  basic: { price: 'достъпна', focus: 'добра стойност' },
  optimal: { price: 'оптимална', focus: 'най-добро съответствие' },
  premium: { price: 'премиум', focus: 'топ формула' },
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

export function buildPortfolioAdvisorNarration(composed, profile, productMap = new Map()) {
  if (profile.selection_mode !== 'single') {
    return buildMockNarration(composed, profile);
  }

  const priority = profile.priority_other || profile.priority || 'здраве';
  const tier_copy = {};
  const product_copy = {};
  const tier_schedules = {};

  for (const key of ['basic', 'optimal', 'premium']) {
    const item = composed.tiers[key]?.products?.[0];
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
  }

  const recommended = composed.recommended_tier || 'optimal';

  return {
    analysis: `Подготвихме три различни продукта в избраната категория за цел „${priority}". Всеки вариант е самостоятелен — без пакет от няколко артикула.`,
    recommended_tier: recommended,
    tier_copy,
    product_copy,
    tier_schedules,
    protocol_schedule: tier_schedules[recommended] || {
      morning: ['Прием според етикета на избрания продукт'],
      weekly_notes: 'Следвайте дозировката на конкретния продукт.',
    },
    lifestyle_tips: [
      'Комбинирайте добавката с балансирано хранене',
      'Пийте достатъчно вода през деня',
      'При хронични заболявания се консултирайте с лекар',
    ],
    disclaimer: 'Информацията не замества лекарска консултация.',
  };
}
