/**
 * Стъпки на Portfolio AI консултант — синхронизирани с portfolio-goals.js и каталога.
 */

import { PORTFOLIO_GOALS } from './portfolio-goals.js';

/** Fallback категории ако bootstrap още не е зареден */
export const FALLBACK_CATALOG_CATEGORIES = [
  'Протеини',
  'Витамини и минерали',
  'Аминокиселини',
  'Креатин',
  'Отслабване',
  'Хербални добавки',
  'Омега мастни киселини',
  'Стави и опорно-двигателна система',
  'Енергия и фокус',
  'Възстановяване и сън',
];

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
    id: 'body',
    title: 'Ръст и тегло',
    hint: 'Използваме ги за ИТМ и дозови насоки (особено при отслабване и мускулна маса).',
    type: 'body',
  },
  {
    id: 'priority',
    title: 'Основна цел',
    hint: 'За персонализация на ползите и приоритета — не ограничава категориите по-долу.',
    type: 'single',
    field: 'priority',
    options: [
      ...PORTFOLIO_GOALS.map((g) => ({ value: g.id, label: g.label })),
      { value: 'other', label: 'Друго', allowsText: true },
    ],
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
export function buildCategoryStep(catalogCategories = [], { singleSelect = false } = {}) {
  const cats = catalogCategories.length ? catalogCategories : FALLBACK_CATALOG_CATEGORIES.map((name) => ({ name }));
  const categoryOptions = cats.map((c) => ({
    value: c.name,
    label: c.count != null ? `${c.name} (${c.count})` : c.name,
  }));

  if (singleSelect) {
    return {
      id: 'product_category',
      title: 'В коя категория да търсим?',
      hint: 'Изберете една категория от каталога — независимо от основната цел. При единичен продукт се търси само в нея.',
      type: 'single',
      field: 'product_category',
      options: categoryOptions,
    };
  }

  return {
    id: 'product_categories',
    title: 'В какви категории да търсим?',
    hint: 'Изберете една или повече категории от каталога — независимо от основната цел. Напр. при „мускулна маса“ може да искате витамини или билки, не само протеин.',
    type: 'multi',
    field: 'product_categories',
    options: [
      { value: 'all', label: 'Всички категории', exclusive: true },
      ...categoryOptions,
    ],
  };
}

/**
 * @param {object} answers
 * @param {{ name: string, count?: number }[]} catalogCategories
 */
export function buildActiveAdvisorSteps(answers = {}, catalogCategories = []) {
  const steps = [];

  for (const step of ADVISOR_STEPS) {
    steps.push(step);
    if (step.field === 'priority') {
      steps.push(buildCategoryStep(catalogCategories, { singleSelect: answers.selection_mode === 'single' }));
    }
  }

  if (answers.sex === 'female') {
    steps.push({
      id: 'pregnancy',
      title: 'Бременност / кърмене',
      type: 'single',
      field: 'pregnancy',
      options: [
        { value: 'no', label: 'Не' },
        { value: 'yes', label: 'Да' },
        { value: 'na', label: 'Не е приложимо' },
      ],
    });
  }

  steps.push({
    id: 'contact',
    title: 'Вашата препоръка е почти готова',
    hint: 'Въведете имейл, за да видите резултата. Ще го използваме при поръчка.',
    type: 'contact',
  });

  return steps;
}
