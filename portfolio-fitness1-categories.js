/**
 * Реални top-level категории от Fitness1 каталога (portfolio/bootstrap).
 * Актуализирано от production на 2026-08-01.
 */
export const FITNESS1_CATALOG_CATEGORIES = [
  'Аксесоари за бокс и ММА',
  'Аминокиселини',
  'Антиоксиданти',
  'Билки',
  'Витамини',
  'Добавки за деца',
  'Други',
  'Здраве и тонус',
  'Здравословни и спортни храни',
  'Изгаряне на мазнини',
  'Качване на маса и възстановяване',
  'Козметика',
  'Креатин',
  'Мастни киселини',
  'Минерали',
  'Мултивитамини',
  'Предтренировъчни добавки',
  'Протеини',
  'Спортни аксесоари и уреди',
  'Стави и сухожилия',
  'Тениски и облекло',
  'Уреди за дома и тялото',
  'Хардкор продукти и стимулатори',
  'Anti-Aging / Против стареене',
];

/** Категории, които никога не се предлагат в AI консултанта */
export const FITNESS1_EXCLUDED_CATEGORIES = new Set([
  'Аксесоари за бокс и ММА',
  'Спортни аксесоари и уреди',
  'Тениски и облекло',
  'Уреди за дома и тялото',
  'Козметика',
  'Други',
]);

/**
 * Explicit goal → category tiers (tier 0 = най-релевантна).
 * Само имена от FITNESS1_CATALOG_CATEGORIES.
 */
export const GOAL_CATEGORY_TIERS = {
  otshalvane: [
    ['Изгаряне на мазнини'],
    ['Билки'],
    ['Аминокиселини'],
    ['Здравословни и спортни храни'],
    ['Антиоксиданти', 'Здраве и тонус'],
    ['Витамини', 'Минерали', 'Мултивитамини', 'Мастни киселини'],
  ],
  muscle: [
    ['Протеини', 'Креатин'],
    ['Качване на маса и възстановяване'],
    ['Аминокиселини'],
    ['Предтренировъчни добавки'],
    ['Здравословни и спортни храни'],
    ['Витамини', 'Минерали', 'Мултивитамини'],
  ],
  health: [
    ['Витамини', 'Минерали', 'Мултивитамини'],
    ['Здраве и тонус'],
    ['Билки', 'Антиоксиданти'],
    ['Мастни киселини'],
    ['Стави и сухожилия'],
    ['Добавки за деца'],
  ],
  antiaging: [
    ['Anti-Aging / Против стареене'],
    ['Антиоксиданти'],
    ['Здраве и тонус'],
    ['Билки'],
    ['Мастни киселини', 'Витамини', 'Минерали', 'Мултивитамини'],
  ],
  energy: [
    ['Предтренировъчни добавки', 'Хардкор продукти и стимулатори'],
    ['Аминокиселини'],
    ['Здраве и тонус'],
    ['Витамини', 'Минерали', 'Мултивитамини'],
  ],
  recovery: [
    ['Качване на маса и възстановяване', 'Стави и сухожилия'],
    ['Аминокиселини', 'Протеини'],
    ['Билки', 'Здраве и тонус'],
    ['Креатин', 'Минерали', 'Мастни киселини'],
  ],
  other: [
    FITNESS1_CATALOG_CATEGORIES.filter((name) => !FITNESS1_EXCLUDED_CATEGORIES.has(name)),
  ],
};

const tierLookupCache = new Map();

function buildTierLookup(goalId) {
  if (tierLookupCache.has(goalId)) return tierLookupCache.get(goalId);

  const tiers = GOAL_CATEGORY_TIERS[goalId] || GOAL_CATEGORY_TIERS.other;
  const lookup = new Map();
  tiers.forEach((tier, tierIndex) => {
    const score = (tiers.length - tierIndex) * 100;
    for (const name of tier) {
      lookup.set(name, score);
    }
  });
  tierLookupCache.set(goalId, lookup);
  return lookup;
}

/**
 * @param {string} categoryName - точно име от каталога
 * @param {string} goalId
 * @returns {number|null} score или null ако няма explicit mapping
 */
export function scoreFitness1CategoryForGoal(categoryName, goalId = 'other') {
  const name = String(categoryName || '').trim();
  if (!name) return null;
  if (FITNESS1_EXCLUDED_CATEGORIES.has(name)) return -1;

  const lookup = buildTierLookup(goalId);
  if (lookup.has(name)) return lookup.get(name);

  return null;
}

export function isFitness1ExcludedCategory(categoryName) {
  return FITNESS1_EXCLUDED_CATEGORIES.has(String(categoryName || '').trim());
}
