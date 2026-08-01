/**
 * Стъпки на Portfolio AI консултант — синхронизирани с portfolio-goals.js и каталога.
 */

import { PORTFOLIO_GOALS } from './portfolio-goals.js';

/** Fallback категории ако bootstrap още не е зареден */
export const FALLBACK_CATALOG_CATEGORIES = [
  'Изгаряне на мазнини',
  'Отслабване',
  'Протеини',
  'Витамини и минерали',
  'Аминокиселини',
  'Креатин',
  'Хербални добавки',
  'Омега мастни киселини',
  'Стави и опорно-двигателна система',
  'Енергия и фокус',
  'Възстановяване и сън',
];

/** Брой категории, маркирани по подразбиране за AI търсене */
export const DEFAULT_ADVISOR_SEARCH_CATEGORIES = 3;

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
 * Правила за релевантност на каталожни категории по цел.
 * tiers[0] = най-висок приоритет (напр. „Изгаряне на мазнини“ при отслабване).
 * Всяка следваща стъпка е по-ниска; count се ползва само при равен score.
 */
const GOAL_CATEGORY_RULES = {
  otshalvane: {
    exclude: [
      'гейн', 'gainer', 'mass', 'маса', 'протеин', 'protein', 'whey', 'суроват', 'казеин', 'casein',
      'креатин', 'creatine', 'preworkout', 'предтрен', 'аксесоар',
    ],
    tiers: [
      [
        'изгаряне на мазнини', 'изгар', 'мазнин', 'fat burn', 'fat burner', 'фет бърн', 'фетбърн',
        'thermo', 'термо', 'thermogenic', 'lipо', 'lipo', 'burner', 'бърнър', 'бърн',
      ],
      ['отслаб', 'отслабване', 'диета', 'diet', 'appetite', 'апетит', 'ситост', 'лида', 'lida', 'slim', 'weight'],
      ['детокс', 'detox', 'метабол', 'metabol', 'целулит', 'cellulite'],
      ['карнитин', 'carnitine', 'l-карнитин', 'l-carnitine'],
      ['хербал', 'herbal', 'fiber', 'фибр', 'берберин', 'berberine'],
      ['витамин', 'vitamin', 'омега', 'omega', 'амино', 'amino'],
    ],
  },
  muscle: {
    exclude: [
      'отслаб', 'отслабване', 'fat burn', 'изгар', 'мазнин', 'thermo', 'термо', 'лида', 'lida',
      'диета', 'diet pill', 'апетит', 'аксесоар',
    ],
    tiers: [
      ['протеин', 'protein', 'whey', 'суроват', 'isolate', 'казеин', 'casein'],
      ['креатин', 'creatine'],
      ['гейн', 'gainer', 'mass', 'маса'],
      ['bcaa', 'амино', 'amino', 'eaa'],
      ['предтрен', 'preworkout', 'pre-workout'],
      ['възстанов', 'recovery'],
    ],
  },
  health: {
    exclude: ['гейн', 'gainer', 'аксесоар', 'preworkout', 'предтрен'],
    tiers: [
      ['витамин', 'vitamin', 'минерал', 'mineral', 'multi'],
      ['имун', 'immune', 'пробиот', 'probiotic'],
      ['омега', 'omega'],
      ['колаген', 'collagen', 'здрав', 'health'],
      ['хербал', 'herbal', 'став', 'joint'],
    ],
  },
  antiaging: {
    exclude: ['гейн', 'gainer', 'протеин', 'protein', 'preworkout', 'предтрен', 'аксесоар'],
    tiers: [
      ['антиейдж', 'anti-aging', 'antiaging', 'longevity', 'nad', 'nmn', 'ревитал'],
      ['колаген', 'collagen', 'coq', 'коензим', 'ubiquinol'],
      ['пептид', 'peptide', 'хиалурон', 'hyaluronic', 'resveratrol'],
      ['витамин', 'vitamin'],
    ],
  },
  energy: {
    exclude: ['гейн', 'gainer', 'сън', 'sleep', 'мелатонин', 'melatonin', 'аксесоар'],
    tiers: [
      ['енерги', 'energy', 'фокус', 'focus', 'stimulant', 'стимул'],
      ['предтрен', 'preworkout', 'pre-workout', 'кофеин', 'caffeine', 'guarana'],
      ['ноотроп', 'nootropic', 'ginkgo'],
      ['витамин', 'vitamin', 'амино', 'amino', 'b12', 'b-complex'],
    ],
  },
  recovery: {
    exclude: ['fat burn', 'изгар', 'мазнин', 'отслаб', 'thermo', 'гейн', 'gainer', 'аксесоар'],
    tiers: [
      ['възстанов', 'recovery', 'релакс', 'relax', 'stress', 'стрес'],
      ['сън', 'sleep', 'мелатонин', 'melatonin', 'zma'],
      ['bcaa', 'глутамин', 'glutamine', 'амино', 'amino'],
      ['колаген', 'collagen', 'став', 'joint', 'магнезий', 'magnesium'],
      ['протеин', 'protein'],
    ],
  },
  other: {
    exclude: ['гейн', 'gainer', 'аксесоар', 'accessory'],
    tiers: [],
  },
};

const FEMALE_ONLY_CONDITIONS = [
  { value: 'pregnancy', label: 'Бременност' },
  { value: 'breastfeeding', label: 'Кърмене' },
];

const BODY_GOAL_IDS = new Set(['otshalvane', 'muscle']);

function normalizeCategoryText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function categoryIsGloballyExcluded(name) {
  const normalized = normalizeCategoryText(name);
  return ADVISOR_EXCLUDED_CATEGORY_PATTERNS.some((pattern) => normalized.includes(normalizeCategoryText(pattern)));
}

function matchesAnyPattern(normalizedName, patterns = []) {
  return patterns.some((pattern) => normalizedName.includes(normalizeCategoryText(pattern)));
}

/**
 * Релевантност на каталожна категория за цел (по-висок = по-приоритетна).
 * @returns {number} -1 ако категорията не е релевантна
 */
export function scoreCategoryForGoal(name, priority = 'other') {
  if (categoryIsGloballyExcluded(name)) return -1;

  const normalized = normalizeCategoryText(name);
  const rules = GOAL_CATEGORY_RULES[priority] || GOAL_CATEGORY_RULES.other;

  if (matchesAnyPattern(normalized, rules.exclude)) return -1;

  if (!rules.tiers?.length) return 1;

  for (let tierIndex = 0; tierIndex < rules.tiers.length; tierIndex += 1) {
    if (matchesAnyPattern(normalized, rules.tiers[tierIndex])) {
      return (rules.tiers.length - tierIndex) * 100;
    }
  }

  return -1;
}

function categoryMatchesGoal(name, priority) {
  return scoreCategoryForGoal(name, priority) > 0;
}

function compareAdvisorCategories(a, b, priority) {
  const scoreDiff = scoreCategoryForGoal(b.name, priority) - scoreCategoryForGoal(a.name, priority);
  if (scoreDiff !== 0) return scoreDiff;
  return (b.count || 0) - (a.count || 0);
}

/**
 * Филтрира и подрежда каталожни категории по релевантност за целта (не само по брой продукти).
 * @param {{ name: string, count?: number }[]} catalogCategories
 * @param {string} [priority]
 */
export function filterCategoriesForAdvisor(catalogCategories = [], priority = 'other') {
  const source = catalogCategories.length
    ? catalogCategories
    : FALLBACK_CATALOG_CATEGORIES.map((name) => ({ name }));

  const goal = priority || 'other';
  return source
    .filter((category) => categoryMatchesGoal(category.name, goal))
    .sort((a, b) => compareAdvisorCategories(a, b, goal));
}

function mapCategoryOptions(categories) {
  return categories.map((category) => ({
    value: category.name,
    label: category.count != null ? `${category.name} (${category.count})` : category.name,
  }));
}

/**
 * Разделя релевантните категории на основни (топ 3) и допълнителни.
 * @param {{ name: string, count?: number }[]} catalogCategories
 * @param {string} [priority]
 */
export function splitAdvisorCategories(catalogCategories = [], priority = 'other') {
  let all = filterCategoriesForAdvisor(catalogCategories, priority);
  if (!all.length) {
    all = filterCategoriesForAdvisor(FALLBACK_CATALOG_CATEGORIES.map((name) => ({ name })), priority);
  }
  return {
    all,
    primary: all.slice(0, DEFAULT_ADVISOR_SEARCH_CATEGORIES),
    more: all.slice(DEFAULT_ADVISOR_SEARCH_CATEGORIES),
  };
}

/** Всички релевантни имена на категории за дадена цел */
export function getRelevantAdvisorCategoryNames(catalogCategories = [], priority = 'other') {
  return splitAdvisorCategories(catalogCategories, priority).all.map((category) => category.name);
}

/** Имена на категориите, маркирани по подразбиране за търсене (топ 3) */
export function getDefaultAdvisorCategoryNames(catalogCategories = [], priority = 'other') {
  return splitAdvisorCategories(catalogCategories, priority).primary.map((category) => category.name);
}

function shouldShowBodyStep(answers = {}) {
  return BODY_GOAL_IDS.has(answers.priority);
}

function adaptStepForProfile(step, answers = {}) {
  if (step.id === 'conditions') {
    const base = step.options.filter((option) => !['pregnancy', 'breastfeeding'].includes(option.value));
    const insertAt = base.findIndex((option) => option.exclusive);
    const femaleOptions = answers.sex === 'female' ? FEMALE_ONLY_CONDITIONS : [];
    const options = insertAt >= 0
      ? [...base.slice(0, insertAt), ...femaleOptions, ...base.slice(insertAt)]
      : [...base, ...femaleOptions];
    return { ...step, options };
  }

  if (step.id === 'medications') {
    const options = step.options.filter((option) => {
      if (option.value === 'hormone_therapy') return answers.sex === 'female';
      return true;
    });
    return { ...step, options };
  }

  return step;
}

export const ADVISOR_STEPS = [
  {
    id: 'selection_mode',
    title: 'Какво търсите?',
    hint: 'Пълен пакет от няколко продукта или фокус върху един основен артикул.',
    type: 'single',
    field: 'selection_mode',
    options: [
      { value: 'package', label: 'Пълен пакет — комбинация от продукти' },
      { value: 'single', label: 'Един основен продукт (3 ценови варианта)' },
    ],
  },
  {
    id: 'sex',
    title: 'Пол',
    hint: 'Влияе на хормоналните и метаболитни препоръки.',
    type: 'single',
    field: 'sex',
    options: [
      { value: 'female', label: 'Жена' },
      { value: 'male', label: 'Мъж' },
    ],
  },
  {
    id: 'age',
    title: 'Възрастова група',
    type: 'single',
    field: 'age_band',
    options: [
      { value: '18-24', label: '18–24' },
      { value: '25-34', label: '25–34' },
      { value: '35-44', label: '35–44' },
      { value: '45-54', label: '45–54' },
      { value: '55-64', label: '55–64' },
      { value: '65+', label: '65+' },
    ],
  },
  {
    id: 'priority',
    title: 'Основна цел',
    hint: 'Определя релевантните категории за търсене по-долу.',
    type: 'single',
    field: 'priority',
    options: [
      ...PORTFOLIO_GOALS.map((g) => ({ value: g.id, label: g.label })),
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
  {
    id: 'body',
    title: 'Ръст и тегло',
    hint: 'Използваме ги за ИТМ и дозови насоки при отслабване и мускулна маса.',
    type: 'body',
  },
  {
    id: 'activity',
    title: 'Физическа активност',
    type: 'single',
    field: 'activity',
    options: [
      { value: 'regular', label: 'Тренирам редовно (3+ пъти седмично)' },
      { value: 'moderate', label: 'Умерена активност (1–2 пъти седмично)' },
      { value: 'rare', label: 'Не тренирам / тренирам рядко' },
    ],
  },
  {
    id: 'diet',
    title: 'Хранителен модел',
    type: 'single',
    field: 'diet',
    options: [
      { value: 'omnivore', label: 'Всеяден' },
      { value: 'vegetarian', label: 'Вегетарианец' },
      { value: 'vegan', label: 'Веган' },
      { value: 'keto', label: 'Кето / нисковъглехидратен' },
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
  {
    id: 'conditions',
    title: 'Медицински състояния',
    hint: 'Отбележете всички приложими. Не спира процеса.',
    type: 'multi',
    field: 'conditions',
    options: [
      { value: 'hypertension', label: 'Хипертония' },
      { value: 'diabetes', label: 'Диабет / инсулинова резистентност' },
      { value: 'thyroid', label: 'Заболяване на щитовидната жлеза' },
      { value: 'autoimmune', label: 'Автоимунно заболяване' },
      { value: 'kidney', label: 'Бъбречно или чернодробно заболяване' },
      { value: 'cardiovascular', label: 'Сърдечно-съдово заболяване' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
  {
    id: 'medications',
    title: 'Медикаменти',
    type: 'multi',
    field: 'medications',
    options: [
      { value: 'anticoagulants', label: 'Антикоагуланти / кръворазреждащи' },
      { value: 'statins', label: 'Статини' },
      { value: 'ssri', label: 'SSRI / SNRI (антидепресанти)' },
      { value: 'hormone_therapy', label: 'Хормонална терапия / контрацепция' },
      { value: 'thyroid_meds', label: 'Медикаменти за щитовидна жлеза' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
  {
    id: 'symptoms',
    title: 'Симптоми / нужди',
    hint: 'Индикатори за възможен дефицит — не заместват лабораторни изследвания.',
    type: 'multi',
    field: 'symptoms',
    options: [
      { value: 'cramps', label: 'Чести мускулни крампи' },
      { value: 'fatigue', label: 'Постоянна умора' },
      { value: 'hair_nails', label: 'Косопад / чупливи нокти' },
      { value: 'concentration', label: 'Затруднена концентрация' },
      { value: 'low_appetite', label: 'Слаб апетит / трудно хранене' },
      { value: 'joint_pain', label: 'Болка или скованост в ставите' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
  {
    id: 'allergies',
    title: 'Алергии и непоносимости',
    type: 'multi',
    field: 'allergies',
    options: [
      { value: 'shellfish', label: 'Миди / ракообразни' },
      { value: 'soy', label: 'Соя' },
      { value: 'gluten', label: 'Глутен' },
      { value: 'lactose', label: 'Лактоза' },
      { value: 'nuts', label: 'Ядки' },
      { value: 'none', label: 'Нищо от изброените', exclusive: true },
      { value: 'other', label: 'Друго', allowsText: true },
    ],
  },
];

export const PRIORITY_LABELS = Object.fromEntries(
  PORTFOLIO_GOALS.map((g) => [g.id, g.label])
);

export const GOAL_IDS = PORTFOLIO_GOALS.map((g) => g.id);

/**
 * Стъпка за избор на продуктови категории (от каталога).
 * @param {{ name: string, count?: number }[]} catalogCategories
 */
export function buildCategoryStep(catalogCategories = [], { singleSelect = false, priority = 'other' } = {}) {
  const { primary, more } = splitAdvisorCategories(catalogCategories, priority);
  const primaryOptions = mapCategoryOptions(primary);
  const moreOptions = mapCategoryOptions(more);

  if (singleSelect) {
    return {
      id: 'product_category',
      title: 'В коя категория да търсим?',
      hint: 'Показани са релевантни категории за вашата цел. По подразбиране е избрана най-приложимата.',
      type: 'category_single',
      field: 'product_category',
      primaryOptions,
      moreOptions,
    };
  }

  return {
    id: 'product_categories',
    title: 'В какви категории да търсим?',
    hint: 'По подразбиране са избрани 3-те най-приложими категории. Разгънете „Още категории“, ако искате да добавите още.',
    type: 'category_multi',
    field: 'product_categories',
    primaryOptions,
    moreOptions,
  };
}

/**
 * Премахва отговори, които вече не са валидни след смяна на пол/цел.
 * @param {object} answers
 */
export function pruneAdvisorAnswers(answers = {}) {
  if (answers.sex !== 'female') {
    if (Array.isArray(answers.conditions)) {
      answers.conditions = answers.conditions.filter((value) => !['pregnancy', 'breastfeeding'].includes(value));
    }
    if (Array.isArray(answers.medications)) {
      answers.medications = answers.medications.filter((value) => value !== 'hormone_therapy');
    }
  }
  delete answers.pregnancy;
  if (!shouldShowBodyStep(answers)) {
    delete answers.height_cm;
    delete answers.weight_kg;
  }
}

/**
 * @param {object} answers
 * @param {{ name: string, count?: number }[]} catalogCategories
 */
export function buildActiveAdvisorSteps(answers = {}, catalogCategories = []) {
  const steps = [];

  for (const step of ADVISOR_STEPS) {
    if (step.id === 'body' && !shouldShowBodyStep(answers)) continue;
    steps.push(adaptStepForProfile(step, answers));
    if (step.field === 'priority') {
      steps.push(buildCategoryStep(catalogCategories, {
        singleSelect: answers.selection_mode === 'single',
        priority: answers.priority || 'other',
      }));
    }
  }

  steps.push({
    id: 'contact',
    title: 'Вашата препоръка е почти готова',
    hint: 'Въведете имейл, за да видите резултата. Ще го използваме при поръчка.',
    type: 'contact',
  });

  return steps;
}
