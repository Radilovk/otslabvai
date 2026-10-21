/**
 * Споделени стъпки за AI консултанти на life-protocols и daotslabna.
 * Цел и категории идват от контекста на сайта — не се питат клиента.
 */

const FEMALE_ONLY_CONDITIONS = [
  { value: 'pcos', label: 'Поликистозни яйчници (PCOS)' },
  { value: 'pregnancy', label: 'Бременност' },
  { value: 'breastfeeding', label: 'Кърмене' },
];
const FEMALE_ONLY_CONDITION_VALUES = FEMALE_ONLY_CONDITIONS.map((o) => o.value);

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
      { value: 'cardiovascular', label: 'Сърдечно-съдово заболяване / аритмия' },
      { value: 'anxiety', label: 'Тревожност / панически атаки' },
      { value: 'epilepsy', label: 'Епилепсия' },
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
      { value: 'bp_meds', label: 'Лекарства за кръвно налягане' },
      { value: 'adhd_stimulants', label: 'Лекарства за ADHD / стимуланти' },
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

/** main: какво стои зад наддаването — определя ролите в програмата (апетит, кръвна захар, стрес). */
const MAIN_EATING_STEP = {
  id: 'eating_pattern',
  title: 'Кое се отнася за храненето ви?',
  hint: 'Изберете всичко приложимо.',
  type: 'multi',
  field: 'eating_pattern',
  options: [
    { value: 'big_portions', label: 'Големи порции / трудно се засищам' },
    { value: 'snacking', label: 'Чести хапвания между храненията' },
    { value: 'sweet_cravings', label: 'Силен глад за сладко' },
    { value: 'night_eating', label: 'Хранене късно вечер или нощем' },
    { value: 'emotional', label: 'Хапвам при стрес, умора или скука' },
    { value: 'none', label: 'Нищо от изброените', exclusive: true },
  ],
};

/** main: храносмилането решава дали фибрите (глюкоманан) са подходящи. */
const MAIN_DIGESTION_STEP = {
  id: 'digestion',
  title: 'Имате ли някое от следните?',
  type: 'multi',
  field: 'digestion',
  options: [
    { value: 'bloating', label: 'Чести подувания / газове' },
    { value: 'constipation', label: 'Запек' },
    { value: 'reflux', label: 'Киселини / рефлукс' },
    { value: 'none', label: 'Нищо от изброените', exclusive: true },
  ],
};

/** Само при диабет: някои лекарства изключват продукти (GLP-1 → без средства за апетит). */
const DIABETES_MEDS_STEP = {
  id: 'diabetes_meds',
  title: 'Какво лечение за кръвната захар получавате?',
  type: 'single',
  field: 'diabetes_meds',
  showWhen: (a) => (a.conditions || []).includes('diabetes'),
  options: [
    { value: 'none', label: 'Без лекарства (диета / движение)' },
    { value: 'metformin', label: 'Метформин' },
    { value: 'insulin_su', label: 'Инсулин или сулфонилурея (напр. гликлазид)' },
    { value: 'glp1', label: 'GLP-1 (Ozempic, Wegovy, Mounjaro, Saxenda)' },
  ],
};

/** Желязо само при доказан дефицит — без изследване не се предлага. */
const IRON_STATUS_STEP = {
  id: 'iron_status',
  title: 'Изследвано ли е желязото / феритинът ви?',
  hint: 'Добавка с желязо даваме само при доказан недостиг.',
  type: 'single',
  field: 'iron_status',
  showWhen: (a) => a.sex === 'female' && (a.symptoms || []).includes('fatigue'),
  options: [
    { value: 'low', label: 'Да — ниско' },
    { value: 'normal', label: 'Да — в норма' },
    { value: 'unknown', label: 'Не съм изследвал(а)' },
  ],
};

/** life → сън: мелатонинът помага при заспиване и смяна на режима, не при ранно будене. */
const LIFE_SLEEP_STEP = {
  id: 'sleep_issue',
  title: 'Какъв е проблемът със съня?',
  type: 'single',
  field: 'sleep_issue',
  showWhen: (a) => a.priority === 'sleep' || (a.symptoms || []).includes('poor_sleep'),
  options: [
    { value: 'falling_asleep', label: 'Трудно заспиване' },
    { value: 'waking', label: 'Будя се през нощта' },
    { value: 'early_waking', label: 'Будя се твърде рано' },
    { value: 'shift_work', label: 'Нощни смени / смяна на часови пояси' },
  ],
};

/** life → кожа: какво точно — решава колаген / биотин / антиоксиданти. */
const LIFE_SKIN_STEP = {
  id: 'skin_concern',
  title: 'Какво искате да подобрите?',
  type: 'single',
  field: 'skin_concern',
  showWhen: (a) => a.priority === 'skin',
  options: [
    { value: 'wrinkles', label: 'Бръчки и еластичност' },
    { value: 'dryness', label: 'Сухота' },
    { value: 'hair_nails', label: 'Коса и нокти' },
    { value: 'acne', label: 'Акне / мазна кожа' },
  ],
};

/** life → стави: възпалителната болка е за лекар, не за добавки. */
const LIFE_JOINT_STEP = {
  id: 'joint_type',
  title: 'Как бихте описали болката в ставите?',
  type: 'single',
  field: 'joint_type',
  showWhen: (a) => a.priority === 'joints' || (a.symptoms || []).includes('joint_pain'),
  options: [
    { value: 'wear', label: 'При натоварване / с възрастта' },
    { value: 'sport', label: 'След тренировки' },
    { value: 'inflammatory', label: 'Подуване, зачервяване или сутрешна скованост над 30 мин' },
  ],
};

/** Повечето бърнъри са стимулантни — този отговор реално изключва продукти. */
const MAIN_STIMULANT_STEP = {
  id: 'stimulant_tolerance',
  showWhen: (a) => !answersExcludeStimulants(a),
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

/** Отговори, при които стимулантите така или иначе отпадат — тогава не питаме за кофеина. */
export function answersExcludeStimulants(a = {}) {
  const conditions = a.conditions || [];
  const meds = a.medications || [];
  return ['hypertension', 'cardiovascular', 'thyroid', 'anxiety', 'epilepsy', 'pregnancy', 'breastfeeding'].some((c) => conditions.includes(c))
    || ['ssri', 'bp_meds', 'adhd_stimulants'].some((m) => meds.includes(m))
    || (a.symptoms || []).includes('poor_sleep')
    || (a.digestion || []).includes('reflux')
    || a.age_band === '65+';
}

const bmiOf = (a) => {
  const h = Number(a.height_cm) / 100;
  const w = Number(a.weight_kg);
  return h > 0 && w > 0 ? w / (h * h) : null;
};

/**
 * Профил, за който програма за отслабване с добавки не е подходяща (daotslabna).
 * @returns {string|null} — причината за клиента
 */
export function mainStopReason(a = {}) {
  const conditions = a.conditions || [];
  const bmiEarly = bmiOf(a);
  if (bmiEarly && bmiEarly < 18.5) {
    return `Индексът на телесна маса (${bmiEarly.toFixed(1)}) е под нормата — отслабване не е препоръчително. Ако имате цел за форма или енергия, вижте протоколите ни за здраве.`;
  }
  if (conditions.includes('pregnancy') || conditions.includes('breastfeeding')) {
    return 'По време на бременност и кърмене не препоръчваме програма за отслабване с добавки. Храненето в този период е най-добре да се съгласува с лекар.';
  }
  if (conditions.includes('eating_disorder')) {
    return 'При хранително разстройство (сега или в миналото) програма за отслабване с добавки не е подходяща. Най-добрата следваща стъпка е разговор със специалист.';
  }
  return null;
}

function adaptStepForProfile(step, answers = {}) {
  if (step.id === 'conditions') {
    const base = step.options.filter((option) => !FEMALE_ONLY_CONDITION_VALUES.includes(option.value));
    const insertAt = base.findIndex((option) => option.exclusive);
    const femaleOptions = answers.sex === 'female' ? FEMALE_ONLY_CONDITIONS : [];
    const options = insertAt >= 0
      ? [...base.slice(0, insertAt), ...femaleOptions, ...base.slice(insertAt)]
      : [...base, ...femaleOptions];
    return { ...step, options };
  }

  if (step.id === 'medications') {
    // Хормонална терапия — и за мъже (тестостерон); при жени включва и контрацепцията.
    const options = step.options.map((option) => (option.value === 'hormone_therapy' && answers.sex === 'male'
      ? { ...option, label: 'Хормонална терапия (вкл. тестостерон)' }
      : option));
    return { ...step, options };
  }

  return step;
}

const CONDITIONAL_STEPS = () => [DIABETES_MEDS_STEP, IRON_STATUS_STEP, LIFE_SLEEP_STEP, LIFE_SKIN_STEP, LIFE_JOINT_STEP, MAIN_STIMULANT_STEP];

/** Отговори на условни въпроси, които вече не се показват (напр. махнат „диабет“), отпадат. */
export function pruneHiddenAnswers(answers = {}) {
  for (const step of CONDITIONAL_STEPS()) {
    if (step.showWhen && !step.showWhen(answers)) delete answers[step.field];
  }
  return answers;
}

export function pruneSiteAdvisorAnswers(answers = {}) {
  if (answers.sex !== 'female') {
    if (Array.isArray(answers.conditions)) {
      answers.conditions = answers.conditions.filter((value) => !FEMALE_ONLY_CONDITION_VALUES.includes(value));
    }
  }
  delete answers.pregnancy;
  pruneHiddenAnswers(answers);
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
    let adapted = adaptStepForProfile(step, answers);
    if (step.id === 'conditions' && isMain) {
      // daotslabna: хранително разстройство — програмата спира (вж. mainStopReason).
      const i = adapted.options.findIndex((o) => o.exclusive);
      adapted = { ...adapted, options: [...adapted.options.slice(0, i), { value: 'eating_disorder', label: 'Хранително разстройство (сега или в миналото)' }, ...adapted.options.slice(i)] };
    }
    if (step.id === 'age' && !isMain) {
      steps.push(adapted, LIFE_PRIORITY_STEP, LIFE_SKIN_STEP);
    } else if (step.id === 'body') {
      steps.push({ ...adapted, hint: meta.bodyHint });
      if (isMain) steps.push(MAIN_WEIGHT_GOAL_STEP, MAIN_EATING_STEP);
    } else if (step.id === 'diet' && isMain) {
      steps.push(adapted, MAIN_DIGESTION_STEP);
    } else if (step.id === 'conditions') {
      steps.push(adapted, DIABETES_MEDS_STEP);
    } else {
      steps.push(adapted);
    }
  }

  steps.push(adaptStepForProfile(isMain ? MAIN_SYMPTOMS_STEP : LIFE_SYMPTOMS_STEP, answers));
  steps.push(IRON_STATUS_STEP);
  if (!isMain) steps.push(LIFE_SLEEP_STEP, LIFE_JOINT_STEP);
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

  // Условните въпроси — само ако предишните отговори ги правят нужни.
  const visible = steps.filter((step) => !step.showWhen || step.showWhen(answers));

  // daotslabna: при неподходящ профил след съответния въпрос идва спиране, без следващите въпроси.
  const stop = isMain ? mainStopReason(answers) : null;
  if (stop) {
    const lowBmi = (bmiOf(answers) || 99) < 18.5;
    const at = visible.findIndex((s) => s.id === (lowBmi ? 'body' : 'conditions'));
    const cut = at >= 0 ? at + 1 : visible.length;
    return [...visible.slice(0, cut), { id: 'stop', type: 'stop', title: 'Програмата не е подходяща за вас', hint: stop }];
  }
  return visible;
}

export function getSiteAdvisorDraftKey(siteId = 'life') {
  return SITE_ADVISOR_META[siteId]?.draftKey || 'lifeProtocolDraft';
}

export function getSiteAdvisorMeta(siteId = 'life') {
  return SITE_ADVISOR_META[siteId] || SITE_ADVISOR_META.life;
}
