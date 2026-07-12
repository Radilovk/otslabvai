/**
 * Portfolio product goals – client-facing grouping (отслабване, мускули, здраве…).
 * Used for catalog filters and index enrichment. Margin/pricing logic stays admin-only.
 */

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
export const GOAL_KEYWORD_HINTS = {
  otshalvane: [
    'отслаб', 'fat burn', 'thermo', 'weight', 'диета', 'слим', 'lida', 'burn', 'appetite',
    'апетит', 'метабол', 'cellulite', 'целулит', 'detox', 'detox'
  ],
  muscle: [
    'протеин', 'protein', 'whey', 'mass', 'gainer', 'гейн', 'креатин', 'creatine', 'bcaa',
    'амино', 'amino', 'isolate', 'казеин', 'casein', 'preworkout', 'предтрен', 'anabolic'
  ],
  health: [
    'витамин', 'vitamin', 'минерал', 'mineral', 'имун', 'immune', 'omega', 'омега',
    'пробиот', 'probiotic', 'колаген', 'collagen', 'joint', 'став', 'multi', 'цинк', 'zinc',
    'магнезий', 'magnesium', 'd3', 'k2', 'health'
  ],
  antiaging: [
    'anti-aging', 'antiaging', 'антиейдж', 'longevity', 'дълголет', 'nad', 'nmn', 'resveratrol',
    'coq10', 'hyaluronic', 'хиалурон', 'peptide', 'пептид', 'rejuven'
  ],
  energy: [
    'energy', 'енерги', 'caffeine', 'кофеин', 'focus', 'фокус', 'cognitive', 'коgnitive',
    'nootropic', 'ноотроп', 'guarana', 'taurine', 'таурин'
  ],
  recovery: [
    'recovery', 'възстанов', 'sleep', 'сън', 'melatonin', 'glutamine',
    'глутамин', 'zma', 'relax', 'релакс', 'stress', 'стрес', 'adaptogen'
  ]
};

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
