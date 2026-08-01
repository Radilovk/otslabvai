/**
 * Функционални слотове и конфликтни групи за комплементарни стекове.
 * Предотвратява повтарящи се/аналогични продукти и опасно натрупване на дози.
 */

import { productSearchText, productMatchesAnyKeyword } from './protocol-safety-rules.js';

/** Групи, от които е позволен само 1 продукт в един стек */
export const STACK_CONFLICT_GROUPS = {
  thermogenic: [
    'fat burn', 'изгар', 'мазнин', 'burner', 'бърн', 'thermo', 'термо', 'thermogenic',
    'лида', 'lida', 'lipо', 'lipo', 'cellulite', 'целулит',
  ],
  stimulant: [
    'preworkout', 'предтрен', 'кофеин', 'caffeine', 'guarana', 'гuarana', 'синефрин', 'synephrine',
    'йохимбин', 'yohimbine', 'ефедр', 'ephedr', 'хардкор', 'стимул', 'stimulant',
  ],
  protein: ['whey', 'суроват', 'протеин', 'protein', 'isolate', 'изолат', 'казеин', 'casein'],
  gainer: ['gainer', 'гейн', 'mass gainer', 'weight gainer', 'качване на маса'],
  creatine: ['creatine', 'креатин', 'кре-алкалин'],
  multivitamin: ['multivitamin', 'мултивит', 'multi-vit', 'мултивитамин'],
  omega3: ['omega', 'омега', 'fish oil', 'рибено масло', 'dha', 'epa'],
  melatonin: ['melatonin', 'мелатонин'],
  berberine: ['berberine', 'берберин'],
  carnitine: ['carnitine', 'карнитин', 'l-carnitine', 'l карнитин'],
  collagen: ['collagen', 'колаген', 'хиалурон', 'hyaluronic'],
  coq10: ['coq10', 'co-q10', 'убихинол', 'ubiquinol', 'коензим q'],
};

/** Слот дефиниции — ключови думи за класификация */
export const SLOT_DEFINITIONS = {
  fat_burner: {
    keywords: ['fat burn', 'изгар', 'мазнин', 'burner', 'thermo', 'термо', 'лида', 'lida', 'thermogenic', 'бърн'],
    conflicts: ['thermogenic', 'stimulant'],
    role: 'core',
    timing: 'сутрин с храна',
  },
  metabolism: {
    keywords: ['carnitine', 'карнитин', 'berberine', 'берберин', 'garcinia', 'гарциния', 'chromium', 'хром', 'метабол'],
    conflicts: ['berberine', 'carnitine'],
    role: 'support',
    timing: 'сутрин с храна',
  },
  stimulant: {
    keywords: ['preworkout', 'предтрен', 'кофеин', 'caffeine', 'хардкор', 'стимул', 'stimulant', 'energy boost'],
    conflicts: ['stimulant', 'thermogenic', 'melatonin'],
    role: 'core',
    timing: 'сутрин, преди активност',
  },
  protein: {
    keywords: ['whey', 'суроват', 'протеин', 'protein', 'isolate', 'изолат', 'казеин', 'casein'],
    conflicts: ['protein', 'gainer'],
    role: 'core',
    timing: 'след тренировка или закуска',
  },
  gainer: {
    keywords: ['gainer', 'гейн', 'mass gainer', 'weight gainer'],
    conflicts: ['gainer', 'protein'],
    role: 'core',
    timing: 'между хранения',
  },
  creatine: {
    keywords: ['creatine', 'креатин', 'кре-алкалин'],
    conflicts: ['creatine'],
    role: 'support',
    timing: 'след тренировка',
  },
  aminos: {
    keywords: ['bcaa', 'eaa', 'глутамин', 'glutamine', 'амино', 'amino acid', 'beta-alanine', 'бета-аланин'],
    conflicts: [],
    role: 'support',
    timing: 'по време или след тренировка',
  },
  multivitamin: {
    keywords: ['multivitamin', 'мултивит', 'multi-vit', 'мултивитамин'],
    conflicts: ['multivitamin'],
    role: 'foundation',
    timing: 'сутрин с храна',
  },
  minerals: {
    keywords: ['магнезий', 'magnesium', 'цинк', 'zinc', 'желязо', 'iron', 'калций', 'calcium', 'd3', 'k2', 'селен', 'selenium'],
    conflicts: [],
    role: 'foundation',
    timing: 'вечер с храна',
  },
  omega3: {
    keywords: ['omega', 'омега', 'fish oil', 'рибено масло', 'dha', 'epa', 'масни киселини'],
    conflicts: ['omega3'],
    role: 'foundation',
    timing: 'с храна',
  },
  herbal: {
    keywords: ['билк', 'herbal', 'ашваганда', 'ashwagandha', 'rodio', 'rhodiola', 'ginkgo', 'echinacea', 'ехинацея'],
    conflicts: [],
    role: 'support',
    timing: 'сутрин или вечер',
  },
  antiaging: {
    keywords: ['anti-aging', 'antiaging', 'антиейдж', 'nmn', 'nad', 'ресвератрол', 'resveratrol', 'астаксантин', 'astaxanthin'],
    conflicts: [],
    role: 'core',
    timing: 'сутрин с храна',
  },
  antioxidant: {
    keywords: ['антиоксидант', 'antioxidant', 'coq10', 'co-q10', 'глутатион', 'glutathione', 'убихинол', 'ubiquinol'],
    conflicts: ['coq10'],
    role: 'support',
    timing: 'сутрин с храна',
  },
  collagen: {
    keywords: ['collagen', 'колаген', 'хиалурон', 'hyaluronic'],
    conflicts: ['collagen'],
    role: 'support',
    timing: 'сутрин на гладно',
  },
  joint: {
    keywords: ['joint', 'став', 'сухожили', 'глюкозамин', 'glucosamine', 'хондроитин', 'chondroitin', 'msm'],
    conflicts: [],
    role: 'support',
    timing: 'с храна',
  },
  sleep: {
    keywords: ['melatonin', 'мелатонин', 'sleep', 'сън', 'zma', 'валериана', 'valerian'],
    conflicts: ['melatonin', 'stimulant'],
    role: 'support',
    timing: 'вечер преди сън',
  },
  immune: {
    keywords: ['имун', 'immune', 'пробиот', 'probiotic', 'витамин c', 'vitamin c', 'цинк', 'zinc'],
    conflicts: [],
    role: 'support',
    timing: 'сутрин с храна',
  },
  foundation: {
    keywords: ['витамин', 'vitamin', 'минерал', 'mineral', 'здраве', 'тонус'],
    conflicts: [],
    role: 'foundation',
    timing: 'сутрин с храна',
  },
};

/** Ред на попълване на слотове по цел */
export const GOAL_SLOT_ORDER = {
  otshalvane: ['fat_burner', 'metabolism', 'herbal', 'foundation', 'omega3'],
  muscle: ['protein', 'creatine', 'aminos', 'foundation'],
  health: ['multivitamin', 'minerals', 'omega3', 'immune', 'joint'],
  antiaging: ['antiaging', 'antioxidant', 'collagen', 'omega3', 'foundation'],
  energy: ['stimulant', 'aminos', 'minerals', 'foundation'],
  recovery: ['sleep', 'aminos', 'joint', 'collagen', 'minerals'],
  other: ['foundation', 'minerals', 'omega3', 'herbal'],
};

const CATEGORY_SLOT_HINTS = [
  ['Изгаряне на мазнини', 'fat_burner'],
  ['Протеини', 'protein'],
  ['Креатин', 'creatine'],
  ['Аминокиселини', 'aminos'],
  ['Витамини', 'foundation'],
  ['Минерали', 'minerals'],
  ['Мултивитамини', 'multivitamin'],
  ['Мастни киселини', 'omega3'],
  ['Билки', 'herbal'],
  ['Антиоксиданти', 'antioxidant'],
  ['Anti-Aging', 'antiaging'],
  ['Стави и сухожилия', 'joint'],
  ['Предтренировъчни', 'stimulant'],
  ['Хардкор', 'stimulant'],
  ['Качване на маса', 'gainer'],
  ['Здраве и тонус', 'foundation'],
];

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getProductConflictGroups(product) {
  const text = normalizeText(productSearchText(product));
  const groups = [];
  for (const [groupId, keywords] of Object.entries(STACK_CONFLICT_GROUPS)) {
    if (productMatchesAnyKeyword(text, keywords)) groups.push(groupId);
  }
  return groups;
}

function scoreSlotMatch(text, categoryTop, slotId, def) {
  let score = 0;
  for (const kw of def.keywords) {
    if (productMatchesAnyKeyword(text, [kw])) score += kw.length;
  }
  for (const [catHint, hintSlot] of CATEGORY_SLOT_HINTS) {
    if (hintSlot === slotId && categoryTop.includes(catHint)) score += 40;
  }
  return score;
}

/** Определя основния функционален слот на продукт */
export function classifyProductSlot(product) {
  const text = normalizeText(productSearchText(product));
  const categoryTop = String(product.system_data?.portfolio?.category_top || '');

  let bestSlot = null;
  let bestScore = 0;

  for (const [slotId, def] of Object.entries(SLOT_DEFINITIONS)) {
    const score = scoreSlotMatch(text, categoryTop, slotId, def);
    if (score > bestScore) {
      bestScore = score;
      bestSlot = slotId;
    }
  }

  if (bestSlot) return bestSlot;

  for (const [catHint, hintSlot] of CATEGORY_SLOT_HINTS) {
    if (categoryTop.includes(catHint)) return hintSlot;
  }

  return 'foundation';
}

export function getSlotMeta(slotId) {
  return SLOT_DEFINITIONS[slotId] || SLOT_DEFINITIONS.foundation;
}

export function getGoalSlotOrder(goalId, profile = {}) {
  const base = GOAL_SLOT_ORDER[goalId] || GOAL_SLOT_ORDER.other;
  const order = [...base];

  if (profile.symptoms?.includes('joint_pain') && !order.includes('joint')) {
    order.splice(2, 0, 'joint');
  }
  if (profile.symptoms?.includes('low_appetite') && goalId === 'muscle' && !order.includes('gainer')) {
    order.splice(1, 0, 'gainer');
  }
  if (profile.activity === 'regular' && goalId === 'muscle' && !order.includes('aminos')) {
    const proteinIdx = order.indexOf('protein');
    if (proteinIdx >= 0 && !order.includes('aminos')) order.splice(proteinIdx + 1, 0, 'aminos');
  }

  return order;
}

export function buildStackItemFromSlot(product, slotId) {
  const meta = getSlotMeta(slotId);
  const packaging = product.public_data?.packaging || {};
  const serving = packaging.serving_size || packaging.capsules_or_grams || packaging.dose_per_serving;
  const dose = serving ? `Според етикета (${serving})` : 'Според етикета';

  return {
    product_id: product.product_id,
    role: meta.role,
    dose,
    timing: meta.timing,
    slot: slotId,
  };
}

export function productsConflictInStack(a, b) {
  const groupsA = new Set(getProductConflictGroups(a));
  const groupsB = getProductConflictGroups(b);
  if (groupsB.some((g) => groupsA.has(g))) return true;

  const slotA = classifyProductSlot(a);
  const slotB = classifyProductSlot(b);
  if (slotA === slotB && slotA !== 'foundation' && slotA !== 'herbal' && slotA !== 'minerals') {
    return true;
  }

  const conflictsA = new Set(getSlotMeta(slotA).conflicts || []);
  const conflictsB = getProductConflictGroups(b);
  if (conflictsB.some((g) => conflictsA.has(g))) return true;

  return false;
}
