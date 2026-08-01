/**
 * Споделена логика за релевантност на категории и продукти по цел (portfolio goals).
 */

/** Категории, които не се предлагат в консултанта (аксесоари и др.) */
export const ADVISOR_EXCLUDED_CATEGORY_PATTERNS = [
  'аксесоар',
  'accessory',
  'accessories',
  'шейкър',
  'shaker',
  'шейкер',
  'облекло',
  'clothing',
  'apparel',
  'тениска',
  'шорти',
  'бутилка',
  'bottle',
  'чаша',
  'ръкавиц',
  'glove',
  'кърпа',
  'чанта',
  'bag',
];

/**
 * Приоритетни нива по цел — tiers[0] е най-релевантно (fat burn при отслабване, протеин при muscle…).
 */
export const GOAL_CATEGORY_RULES = {
  otshalvane: {
    exclude: [
      'гейн', 'gainer', 'mass', 'маса', 'протеин', 'protein', 'whey', 'суроват', 'казеин', 'casein',
      'креатин', 'creatine', 'preworkout', 'предтрен', 'аксесоар',
    ],
    tiers: [
      [
        'изгаряне на мазнини', 'изгар', 'мазнин', 'fat burn', 'fat burner', 'фет бърн', 'фетбърн', 'фет бърнър',
        'thermo', 'термо', 'thermogenic', 'lipо', 'lipo', 'burner', 'бърнър', 'бърн', 'thermo caps',
      ],
      ['отслаб', 'отслабване', 'диета', 'diet', 'appetite', 'апетит', 'ситост', 'лида', 'lida', 'slim', 'weight'],
      ['детокс', 'detox', 'метабол', 'metabol', 'целулит', 'cellulite', 'берберин', 'berberine'],
      ['карнитин', 'carnitine', 'l-карнитин', 'l-carnitine'],
      ['хербал', 'herbal', 'fiber', 'фибр', '5-htp', 'garcinia', 'гарциния'],
      ['витамин', 'vitamin', 'омега', 'omega', 'амино', 'amino'],
    ],
  },
  muscle: {
    exclude: [
      'отслаб', 'отслабване', 'fat burn', 'изгар', 'мазнин', 'thermo', 'термо', 'лида', 'lida',
      'диета', 'diet pill', 'апетит', 'аксесоар',
    ],
    tiers: [
      ['протеин', 'protein', 'whey', 'суроват', 'isolate', 'изолат', 'казеин', 'casein', 'mass protein'],
      ['креатин', 'creatine', 'кре-алкалин'],
      ['гейн', 'gainer', 'mass', 'маса', 'weight gainer'],
      ['bcaa', 'амино', 'amino', 'eaa', 'glutamine', 'глутамин'],
      ['предтрен', 'preworkout', 'pre-workout', 'pump'],
      ['възстанов', 'recovery', 'zma'],
    ],
  },
  health: {
    exclude: ['гейн', 'gainer', 'аксесоар', 'preworkout', 'предтрен', 'fat burn', 'изгар'],
    tiers: [
      ['витамин', 'vitamin', 'минерал', 'mineral', 'multi', 'мултивит'],
      ['имун', 'immune', 'пробиот', 'probiotic', 'echinacea', 'ехинацея'],
      ['омега', 'omega', 'рибено масло', 'fish oil'],
      ['колаген', 'collagen', 'здрав', 'health', 'минерали'],
      ['хербал', 'herbal', 'став', 'joint', 'магнезий', 'magnesium', 'цинк', 'zinc', 'd3', 'k2'],
    ],
  },
  antiaging: {
    exclude: ['гейн', 'gainer', 'протеин', 'protein', 'preworkout', 'предтрен', 'аксесоар', 'fat burn'],
    tiers: [
      ['антиейдж', 'anti-aging', 'antiaging', 'longevity', 'nad', 'nmn', 'ревитал', 'дълголет'],
      ['колаген', 'collagen', 'хиалурон', 'hyaluronic', 'resveratrol', 'ресвератрол'],
      ['coq', 'коензим', 'ubiquinol', 'глутатион', 'glutathione'],
      ['пептид', 'peptide', 'астаксантин', 'astaxanthin'],
      ['витамин', 'vitamin', 'астрагал', 'astragalus'],
    ],
  },
  energy: {
    exclude: ['гейн', 'gainer', 'сън', 'sleep', 'мелатонин', 'melatonin', 'аксесоар', 'fat burn'],
    tiers: [
      ['енерги', 'energy', 'фокус', 'focus', 'stimulant', 'стимул', 'alertness'],
      ['предтрен', 'preworkout', 'pre-workout', 'кофеин', 'caffeine', 'guarana', 'таурин', 'taurine'],
      ['ноотроп', 'nootropic', 'ginkgo', 'rhodiola', 'родиола', 'ашваганда', 'ashwagandha'],
      ['витамин', 'vitamin', 'амино', 'amino', 'b12', 'b-complex', 'b комплекс'],
    ],
  },
  recovery: {
    exclude: ['fat burn', 'изгар', 'мазнин', 'отслаб', 'thermo', 'гейн', 'gainer', 'аксесоар'],
    tiers: [
      ['възстанов', 'recovery', 'релакс', 'relax', 'stress', 'стрес', 'adaptogen', 'адаптоген'],
      ['сън', 'sleep', 'мелатонин', 'melatonin', 'zma', 'valerian', 'валериана'],
      ['bcaa', 'глутамин', 'glutamine', 'амино', 'amino', 'eaa'],
      ['колаген', 'collagen', 'став', 'joint', 'глюкозамин', 'glucosamine', 'магнезий', 'magnesium'],
      ['протеин', 'protein', 'казеин', 'casein'],
    ],
  },
  other: {
    exclude: ['гейн', 'gainer', 'аксесоар', 'accessory'],
    tiers: [],
  },
};

/** Keyword hints за inferProductGoals — синхронизирани с tiers */
export const GOAL_KEYWORD_HINTS = {
  otshalvane: [
    'изгар', 'мазнин', 'fat burn', 'fat burner', 'фет бърн', 'thermo', 'термо', 'отслаб', 'отслабване',
    'диета', 'слим', 'lida', 'лида', 'burn', 'burner', 'lipо', 'lipo', 'appetite', 'апетит', 'метабол',
    'cellulite', 'целулит', 'detox', 'детокс', 'карнитин', 'carnitine', 'берберин', 'garcinia',
  ],
  muscle: [
    'протеин', 'protein', 'whey', 'суроват', 'isolate', 'mass', 'gainer', 'гейн', 'креатин', 'creatine',
    'bcaa', 'амино', 'amino', 'казеин', 'casein', 'preworkout', 'предтрен', 'anabolic', 'глутамин',
  ],
  health: [
    'витамин', 'vitamin', 'минерал', 'mineral', 'имун', 'immune', 'omega', 'омега', 'пробиот', 'probiotic',
    'колаген', 'collagen', 'joint', 'став', 'multi', 'мултивит', 'цинк', 'zinc', 'магнезий', 'magnesium',
    'd3', 'k2', 'health', 'здрав',
  ],
  antiaging: [
    'anti-aging', 'antiaging', 'антиейдж', 'longevity', 'дълголет', 'nad', 'nmn', 'resveratrol', 'coq10',
    'coq', 'hyaluronic', 'хиалурон', 'peptide', 'пептид', 'rejuven', 'глутатион', 'glutathione', 'астаксантин',
  ],
  energy: [
    'energy', 'енерги', 'caffeine', 'кофеин', 'focus', 'фокус', 'cognitive', 'nootropic', 'ноотроп',
    'guarana', 'taurine', 'таурин', 'preworkout', 'предтрен', 'rhodiola', 'родиола',
  ],
  recovery: [
    'recovery', 'възстанов', 'sleep', 'сън', 'melatonin', 'мелатонин', 'glutamine', 'глутамин', 'zma',
    'relax', 'релакс', 'stress', 'стрес', 'adaptogen', 'адаптоген', 'bcaa', 'joint', 'став', 'колаген',
  ],
};

const GOAL_CONFLICTS = {
  otshalvane: ['muscle'],
  muscle: ['otshalvane'],
  energy: ['recovery'],
  recovery: ['energy'],
};

export function normalizeGoalText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function categoryIsGloballyExcluded(name) {
  const normalized = normalizeGoalText(name);
  return ADVISOR_EXCLUDED_CATEGORY_PATTERNS.some((pattern) => normalized.includes(normalizeGoalText(pattern)));
}

function matchesAnyPattern(normalizedText, patterns = []) {
  return patterns.some((pattern) => normalizedText.includes(normalizeGoalText(pattern)));
}

function scoreTextForGoal(normalizedText, priority = 'other') {
  const rules = GOAL_CATEGORY_RULES[priority] || GOAL_CATEGORY_RULES.other;

  if (matchesAnyPattern(normalizedText, rules.exclude)) return -1;
  if (!rules.tiers?.length) return 1;

  let best = -1;
  for (let tierIndex = 0; tierIndex < rules.tiers.length; tierIndex += 1) {
    if (matchesAnyPattern(normalizedText, rules.tiers[tierIndex])) {
      best = Math.max(best, (rules.tiers.length - tierIndex) * 100);
    }
  }
  return best;
}

/**
 * Релевантност на каталожна категория за цел (по-висок = по-приоритетна).
 * @returns {number} -1 ако категорията не е релевантна
 */
export function scoreCategoryForGoal(name, priority = 'other') {
  if (categoryIsGloballyExcluded(name)) return -1;
  return scoreTextForGoal(normalizeGoalText(name), priority);
}

function productGoalHaystack(product) {
  const portfolio = product.system_data?.portfolio || {};
  return normalizeGoalText([
    product.public_data?.name,
    product.public_data?.tagline,
    product.public_data?.description,
    portfolio.category,
    portfolio.category_top,
    ...(portfolio.category_path || []),
    ...(product.system_data?.goals || []),
  ].filter(Boolean).join(' '));
}

/**
 * Релевантност на продукт за цел — комбинира категория, име и inferred goals.
 * @returns {number} -1 ако продуктът е нерелевантен/конфликтен
 */
export function scoreProductForGoal(product, priority = 'other') {
  const portfolio = product.system_data?.portfolio || {};
  const segments = [
    portfolio.category_top,
    ...(portfolio.category_path || []),
    portfolio.category,
  ].filter(Boolean);

  let best = -1;
  for (const segment of segments) {
    best = Math.max(best, scoreCategoryForGoal(segment, priority));
  }

  const haystack = productGoalHaystack(product);
  best = Math.max(best, scoreTextForGoal(haystack, priority));

  return best;
}

export function getGoalConflicts(priority) {
  return GOAL_CONFLICTS[priority] || [];
}
