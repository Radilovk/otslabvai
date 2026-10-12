/**
 * Споделени стъпки за AI консултанти на life-protocols и daotslabna.
 * Цел и категории идват от контекста на сайта — не се питат клиента.
 */

const FEMALE_ONLY_CONDITIONS = [
  { value: 'pregnancy', label: 'Бременност' },
  { value: 'breastfeeding', label: 'Кърмене' },
];

export const SITE_ADVISOR_META = {
  life: {
    siteId: 'life',
    pageTitle: 'Персонален anti-aging протокол',
    pageSubtitle: 'Кратък профил → индивидуален стак с точни продукти и дози',
    bodyHint: 'Ръст и тегло ни помагат да подберем дозите и интензитета.',
    contactTitle: 'Готов е вашият протокол',
    contactHint: 'Оставете имейл, за да видите трите варианта и да поръчате директно.',
    contactCta: 'Виж моя протокол',
    draftKey: 'lifeProtocolDraft',
    defaultPriority: 'longevity',
  },
  main: {
    siteId: 'main',
    pageTitle: 'Персонална програма за отслабване',
    pageSubtitle: 'Кратък профил → три готови варианта с продукти, дози и график',
    bodyHint: 'Ръст и тегло ни помагат да насочим програмата към вашите цели.',
    contactTitle: 'Готова е вашата програма',
    contactHint: 'Оставете имейл, за да видите трите варианта и да поръчате директно.',
    contactCta: 'Виж моята програма',
    draftKey: 'mainAdvisorDraft',
    defaultPriority: 'otshalvane',
  },
};

const BASE_STEPS = [
  {
    id: 'sex',
    title: 'Пол',
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
    title: 'Здравен статус',
    hint: 'Отбележете всички приложими състояния.',
    type: 'multi',
    field: 'conditions',
    options: [
      { value: 'hypertension', label: 'Хипертония' },
      { value: 'diabetes', label: 'Диабет / инсулинова резистентност' },
      { value: 'thyroid', label: 'Заболяване на щитовидната жлеза' },
      { value: 'autoimmune', label: 'Автоимунно заболяване' },
      { value: 'kidney', label: 'Бъбречно заболяване' },
      { value: 'liver', label: 'Чернодробно заболяване' },
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
];

/** life: клиентът избира фокус — сменя точкуването на продуктите. */
export const LIFE_PRIORITY_STEP = {
  id: 'priority',
  title: 'Какъв е основният ви фокус?',
  type: 'single',
  field: 'priority',
  options: [
    { value: 'longevity', label: 'Общо дълголетие и антиейджинг' },
    { value: 'energy', label: 'Енергия и издръжливост' },
    { value: 'skin', label: 'Кожа, коса, нокти' },
    { value: 'sleep', label: 'Сън и възстановяване' },
    { value: 'cognition', label: 'Фокус и памет' },
    { value: 'joints', label: 'Стави и подвижност' },
  ],
};

const MAIN_WEIGHT_GOAL_STEP = {
  id: 'weight_goal',
  title: 'Колко килограма искате да свалите?',
  type: 'single',
  field: 'weight_goal',
  options: [
    { value: '1-5', label: 'До 5 кг' },
    { value: '5-10', label: '5–10 кг' },
    { value: '10-20', label: '10–20 кг' },
    { value: '20+', label: 'Над 20 кг' },
  ],
};

/** Повечето бърнъри са стимулантни — този отговор реално изключва продукти. */
const MAIN_STIMULANT_STEP = {
  id: 'stimulant_tolerance',
  title: 'Как понасяте кофеин?',
  hint: 'Повечето фет бърнъри съдържат кофеин или други стимуланти.',
  type: 'single',
  field: 'stimulant_tolerance',
  options: [
    { value: 'ok', label: 'Добре — пия кафе без проблем' },
    { value: 'sensitive', label: 'Чувствителен/а съм — сърцебиене, безпокойство или лош сън' },
    { value: 'avoid', label: 'Искам програма без стимуланти' },
  ],
};

const MAIN_BUDGET_STEP = {
  id: 'budget_band',
  title: 'Какъв месечен бюджет предвиждате?',
  hint: 'Ще препоръчаме варианта, който се вписва в него.',
  type: 'single',
  field: 'budget_band',
  options: [
    { value: 'up30', label: 'До 30 €' },
    { value: '30-60', label: '30–60 €' },
    { value: '60-100', label: '60–100 €' },
    { value: '100+', label: 'Над 100 €' },
  ],
};

const LIFE_SYMPTOMS_STEP = {
  id: 'symptoms',
  title: 'Симптоми и нужди',
  hint: 'Помага ни да подберем правилните активни вещества.',
  type: 'multi',
  field: 'symptoms',
  options: [
    { value: 'cramps', label: 'Чести мускулни крампи' },
    { value: 'fatigue', label: 'Постоянна умора' },
    { value: 'hair_nails', label: 'Косопад / чупливи нокти' },
    { value: 'concentration', label: 'Затруднена концентрация' },
    { value: 'poor_sleep', label: 'Лош или неспокоен сън' },
    { value: 'joint_pain', label: 'Болка или скованост в ставите' },
    { value: 'none', label: 'Нищо от изброените', exclusive: true },
    { value: 'other', label: 'Друго', allowsText: true },
  ],
};

const MAIN_SYMPTOMS_STEP = {
  id: 'symptoms',
  title: 'Какво ви затруднява най-много?',
  hint: 'Изберете всичко приложимо — така насочваме програмата.',
  type: 'multi',
  field: 'symptoms',
  options: [
    { value: 'fatigue', label: 'Постоянна умора' },
    { value: 'cravings', label: 'Трудно контролиран апетит' },
    { value: 'poor_sleep', label: 'Лош сън' },
    { value: 'joint_pain', label: 'Болки в ставите при движение' },
    { value: 'concentration', label: 'Липса на фокус / мотивация' },
    { value: 'none', label: 'Нищо от изброените', exclusive: true },
    { value: 'other', label: 'Друго', allowsText: true },
  ],
};

const ALLERGIES_STEP = {
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
};

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

export function pruneSiteAdvisorAnswers(answers = {}) {
  if (answers.sex !== 'female') {
    if (Array.isArray(answers.conditions)) {
      answers.conditions = answers.conditions.filter((value) => !['pregnancy', 'breastfeeding'].includes(value));
    }
    if (Array.isArray(answers.medications)) {
      answers.medications = answers.medications.filter((value) => value !== 'hormone_therapy');
    }
  }
  delete answers.pregnancy;
}

/**
 * @param {'life' | 'main'} siteId
 * @param {object} answers
 */
export function buildSiteAdvisorSteps(siteId = 'life', answers = {}) {
  const meta = SITE_ADVISOR_META[siteId] || SITE_ADVISOR_META.life;
  const steps = [];
  const isMain = siteId === 'main';

  for (const step of BASE_STEPS) {
    const adapted = adaptStepForProfile(step, answers);
    if (step.id === 'age' && !isMain) {
      steps.push(adapted, LIFE_PRIORITY_STEP);
    } else if (step.id === 'body') {
      steps.push({ ...adapted, hint: meta.bodyHint });
      if (isMain) steps.push(MAIN_WEIGHT_GOAL_STEP);
    } else {
      steps.push(adapted);
    }
  }

  steps.push(adaptStepForProfile(isMain ? MAIN_SYMPTOMS_STEP : LIFE_SYMPTOMS_STEP, answers));
  if (isMain) steps.push(MAIN_STIMULANT_STEP);
  steps.push(ALLERGIES_STEP);
  if (isMain) steps.push(MAIN_BUDGET_STEP);

  steps.push({
    id: 'contact',
    title: meta.contactTitle,
    hint: meta.contactHint,
    type: 'contact',
    ctaLabel: meta.contactCta,
  });

  return steps;
}

export function getSiteAdvisorDraftKey(siteId = 'life') {
  return SITE_ADVISOR_META[siteId]?.draftKey || 'lifeProtocolDraft';
}

export function getSiteAdvisorMeta(siteId = 'life') {
  return SITE_ADVISOR_META[siteId] || SITE_ADVISOR_META.life;
}
