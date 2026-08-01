/**
 * Portfolio product goals – client-facing grouping (отслабване, мускули, здраве…).
 * Used for catalog filters and index enrichment. Margin/pricing logic stays admin-only.
 */

import { GOAL_KEYWORD_HINTS } from './portfolio-goal-relevance.js';

export { GOAL_KEYWORD_HINTS };

export const PORTFOLIO_GOALS = [
  { id: 'otshalvane', label: 'Отслабване' },
  { id: 'muscle', label: 'Мускулна маса' },
  { id: 'health', label: 'Здраве и имунитет' },
  { id: 'antiaging', label: 'Антиейджинг' },
  { id: 'energy', label: 'Енергия и фокус' },
  { id: 'recovery', label: 'Възстановяване' }
];

const GOAL_LABEL_BY_ID = Object.fromEntries(PORTFOLIO_GOALS.map((g) => [g.id, g.label]));

/** Keyword hints per goal – matched against category, name and search text. */

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Infer goal tags for a catalog entry.
 * @param {object} entry - index entry fields
 * @param {object} [settings] - portfolio settings (product_overrides may include goals)
 */
export function inferProductGoals(entry, settings = null) {
  const overrideGoals = settings?.product_overrides?.[entry.group_id]?.goals;
  if (Array.isArray(overrideGoals) && overrideGoals.length) {
    return [...new Set(overrideGoals.map((g) => String(g).trim()).filter(Boolean))];
  }

  const haystack = normalizeForMatch(
    [
      entry.name,
      entry.brand,
      entry.category,
      entry.category_top,
      ...(entry.category_path || []),
      entry.search_text
    ].filter(Boolean).join(' ')
  );

  const matched = [];
  for (const [goalId, keywords] of Object.entries(GOAL_KEYWORD_HINTS)) {
    if (keywords.some((kw) => haystack.includes(normalizeForMatch(kw)))) {
      matched.push(goalId);
    }
  }

  return matched.length ? matched : ['health'];
}

export function getGoalLabel(goalId) {
  return GOAL_LABEL_BY_ID[goalId] || goalId;
}

export function buildGoalFacetCounts(index) {
  const counts = new Map();
  for (const item of index || []) {
    for (const goalId of item.goals || []) {
      counts.set(goalId, (counts.get(goalId) || 0) + 1);
    }
  }
  return PORTFOLIO_GOALS
    .filter((g) => counts.has(g.id))
    .map((g) => ({ id: g.id, label: g.label, count: counts.get(g.id) }));
}
