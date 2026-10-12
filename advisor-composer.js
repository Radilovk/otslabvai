/**
 * Съставяне на пакети за трите консултанта по „план от слотове“:
 *   основен продукт за целта → слотове за симптомите → поддържащи слотове за целта → универсални.
 * Нивата са вложени (basic ⊂ optimal ⊂ premium): клиентът вижда „започни с това, добави това“.
 * Входът е вече филтриран (безопасност, наличност, марж) и подреден (релевантност → печалба).
 */
import { getProductFacts, factsConflict, SLOT_META } from './advisor-product-facts.js';
import { getMustIncludeKeywords, productMatchesAnyKeyword, productSearchText } from './protocol-safety-rules.js';

/** Цел → стъпки; всяка стъпка е списък от взаимозаменяеми слотове. Първата стъпка е основният продукт. */
export const GOAL_PLANS = {
  otshalvane: [
    ['fat_burner', 'fat_burner_nonstim'],
    ['appetite'],
    ['carnitine', 'cla'],
    ['protein', 'meal'],
    ['glucose'],
    ['multivitamin'],
    ['omega3'],
    ['magnesium'],
  ],
  muscle: [
    ['protein'],
    ['creatine'],
    ['aminos'],
    ['preworkout', 'pump'],
    ['multivitamin'],
    ['magnesium', 'minerals'],
    ['omega3'],
    ['joint'],
  ],
  health: [
    ['multivitamin'],
    ['vitamin_d'],
    ['omega3'],
    ['magnesium'],
    ['vitamin_c', 'immune'],
    ['gut'],
    ['coq10'],
    ['joint'],
  ],
  longevity: [
    ['longevity', 'coq10'],
    ['antioxidant'],
    ['omega3'],
    ['collagen'],
    ['vitamin_d', 'multivitamin'],
    ['magnesium'],
    ['adaptogen'],
    ['cognition'],
  ],
  energy: [
    ['b_complex', 'multivitamin'],
    ['coq10'],
    ['adaptogen'],
    ['magnesium'],
    ['omega3'],
    ['electrolytes'],
    ['longevity'],
  ],
  recovery: [
    ['sleep', 'magnesium'],
    ['aminos'],
    ['joint'],
    ['collagen'],
    ['electrolytes'],
    ['omega3'],
    ['protein'],
  ],
  skin: [
    ['collagen'],
    ['beauty'],
    ['antioxidant'],
    ['omega3'],
    ['vitamin_c'],
    ['longevity'],
  ],
  sleep: [
    ['sleep'],
    ['magnesium'],
    ['adaptogen'],
    ['omega3'],
    ['longevity', 'antioxidant'],
  ],
  cognition: [
    ['cognition'],
    ['omega3'],
    ['b_complex'],
    ['coq10', 'longevity'],
    ['adaptogen'],
    ['magnesium'],
  ],
  joints: [
    ['joint'],
    ['collagen'],
    ['omega3'],
    ['vitamin_d'],
    ['antioxidant'],
    ['magnesium'],
  ],
};

/** Енергия в biocode позволява предтренировъчни/кофеин (ако профилът допуска стимуланти). */
const BIOCODE_ENERGY_EXTRA = [['caffeine', 'preworkout']];

const GOAL_ALIASES = { antiaging: 'longevity', other: 'health', otshalvane: 'otshalvane' };

const SYMPTOM_SLOTS = {
  fatigue: [['b_complex', 'coq10']],
  cramps: [['magnesium']],
  hair_nails: [['beauty', 'collagen']],
  concentration: [['cognition', 'omega3']],
  poor_sleep: [['sleep', 'magnesium']],
  joint_pain: [['joint']],
  cravings: [['appetite']],
  low_appetite: [['gainer']],
};

/** Ако няма нищо от плана — безопасни универсални добавки, за да има пълен пакет. */
const UNIVERSAL_STEPS = [['multivitamin'], ['omega3'], ['magnesium'], ['vitamin_d'], ['b_complex'], ['antioxidant']];

function stepKey(step) {
  return step.join('|');
}

/**
 * План за конкретния профил.
 * @returns {{ slots: string[], reason: string }[]}
 */
export function buildSlotPlan(goal, profile = {}, { siteId = 'portfolio' } = {}) {
  const key = GOAL_ALIASES[goal] || goal;
  const base = (GOAL_PLANS[key] || GOAL_PLANS.health).map((slots, i) => ({ slots, reason: i === 0 ? 'core' : 'goal' }));
  if (key === 'energy' && siteId === 'portfolio') base.splice(1, 0, ...BIOCODE_ENERGY_EXTRA.map((slots) => ({ slots, reason: 'goal' })));

  const symptomSteps = [];
  for (const symptom of profile.symptoms || []) {
    for (const slots of SYMPTOM_SLOTS[symptom] || []) symptomSteps.push({ slots, reason: `symptom:${symptom}` });
  }
  // Желязо само при жени с умора и без чернодробно заболяване.
  if ((profile.symptoms || []).includes('fatigue') && profile.sex === 'female' && !(profile.conditions || []).includes('liver')) {
    symptomSteps.push({ slots: ['iron'], reason: 'symptom:fatigue' });
  }
  if (profile.menopause_context && ['health', 'longevity', 'energy', 'skin', 'sleep'].includes(key)) {
    symptomSteps.push({ slots: ['womens'], reason: 'menopause' });
  }
  if (profile.activity === 'regular' && key === 'otshalvane') {
    symptomSteps.push({ slots: ['protein', 'meal'], reason: 'activity' });
  }

  const plan = [base[0]];
  const seen = new Set([stepKey(base[0].slots)]);
  const push = (step) => {
    // Стъпка, чиито слотове вече са покрити от по-ранна стъпка, се пропуска.
    const k = stepKey(step.slots);
    if (seen.has(k)) return;
    if (step.slots.every((s) => plan.some((p) => p.slots.includes(s)))) return;
    seen.add(k);
    plan.push(step);
  };
  for (const step of symptomSteps) push(step);
  for (const step of base.slice(1)) push(step);
  return plan;
}

function priceOf(product) {
  return getProductFacts(product).price || 0;
}

function findMustInclude(profile, rankedEntries) {
  const keywords = getMustIncludeKeywords(profile);
  if (!keywords.length) return null;
  const hit = rankedEntries.find(({ product }) => productMatchesAnyKeyword(productSearchText(product), keywords));
  return hit?.product || null;
}

function buildPools(rankedEntries) {
  const pools = new Map();
  rankedEntries.forEach((entry, index) => {
    const { slot } = getProductFacts(entry.product);
    if (!pools.has(slot)) pools.set(slot, []);
    pools.get(slot).push({ ...entry, index });
  });
  return pools;
}

function candidatesForStep(pools, slots) {
  return slots.flatMap((s) => pools.get(s) || []).sort((a, b) => a.index - b.index);
}

/** Основният продукт: от водещите по релевантност — първият, който се вписва в базовия бюджет; иначе най-евтиният от тях. */
function pickCore(candidates, basicBudget) {
  const top = candidates.slice(0, 5);
  if (!top.length) return null;
  const fits = top.find((e) => priceOf(e.product) > 0 && priceOf(e.product) <= basicBudget);
  if (fits) return fits.product;
  return top.reduce((min, e) => (priceOf(e.product) < priceOf(min.product) ? e : min)).product;
}

function toItem(product, role) {
  const facts = getProductFacts(product);
  const packaging = product.public_data?.packaging || {};
  const serving = packaging.serving_size || packaging.dose_per_serving;
  return {
    product_id: product.product_id,
    role,
    slot: facts.slot,
    dose: serving ? `Според етикета (${serving})` : 'Според етикета',
    timing: SLOT_META[facts.slot]?.timing || 'според етикета',
  };
}

/** Колко продукта влизат във всяко ниво — винаги нарастващо (напр. 1/2/3, 2/3/4, 3/5/6). */
export function tierCounts(n, limits) {
  const premium = Math.min(n, limits.premium.max);
  const optimal = Math.min(limits.optimal.max, premium - (premium > 2 ? 1 : 0));
  const basic = Math.max(1, Math.min(limits.basic.max, optimal - 1));
  return { basic, optimal, premium };
}

/**
 * Алтернативи за основния слот: 3 различни продукта (икономичен / препоръчан / премиум).
 * Ползва се за „един продукт“ в biocode и когато каталогът няма поддържащи продукти.
 */
/**
 * @param {object} profile
 * @param {{ product: object, score?: number }[]} rankedEntries
 * @param {{ plan?: { slots: string[], reason: string }[], tierMeta?: any, tierLimits?: any }} [options]
 */
export function composeAlternatives(profile, rankedEntries, { plan = undefined, tierMeta = {}, tierLimits = null } = {}) {
  const pools = buildPools(rankedEntries);
  const steps = plan || buildSlotPlan(profile.priority, profile);
  let pool = [];
  for (const step of steps) {
    pool = candidatesForStep(pools, step.slots);
    if (pool.length >= 3) break;
  }
  if (pool.length < 3) pool = rankedEntries.map((e, index) => ({ ...e, index }));
  const top = pool.slice(0, 8).filter((e) => priceOf(e.product) > 0);
  if (!top.length) throw new Error('Няма подходящи продукти.');

  const optimal = top[0].product;
  const others = top.slice(1).map((e) => e.product);
  const basicBudget = tierLimits?.basic?.budgetEur ?? Infinity;
  const premiumBudget = tierLimits?.premium?.budgetEur ?? Infinity;
  const cheaper = others.filter((p) => priceOf(p) < priceOf(optimal) && priceOf(p) <= basicBudget * 1.5);
  const basic = cheaper.sort((a, b) => priceOf(a) - priceOf(b))[0]
    || others.sort((a, b) => priceOf(a) - priceOf(b))[0] || optimal;
  const pricier = others.filter((p) => p.product_id !== basic.product_id && priceOf(p) > priceOf(optimal) && priceOf(p) <= premiumBudget);
  // Премиум: следващият по релевантност, който е по-скъп (по-голяма опаковка/по-силна формула), не най-скъпият изобщо.
  const premium = pricier[0]
    || others.find((p) => p.product_id !== basic.product_id) || optimal;

  const tier = (product) => ({ products: [toItem(product, 'core')] });
  return {
    recommended_tier: 'optimal',
    tiers: {
      basic: { ...tierMeta.basic, ...tier(basic) },
      optimal: { ...tierMeta.optimal, ...tier(optimal) },
      premium: { ...tierMeta.premium, ...tier(premium) },
    },
    meta: {
      mode: 'alternatives',
      ranked_pool_size: rankedEntries.length,
      core_slot: getProductFacts(optimal).slot,
      distinct_products: new Set([basic.product_id, optimal.product_id, premium.product_id]).size,
    },
  };
}

/**
 * @param {object} profile
 * @param {{ product: object, score: number }[]} rankedEntries
 * @param {{ tierLimits: object, tierMeta?: object, goal?: string, siteId?: string }} options
 */
export function composeAdvisorStacks(profile, rankedEntries, options) {
  const limits = options.tierLimits;
  const meta = options.tierMeta || {};
  const goal = options.goal || profile.priority || 'health';
  const plan = buildSlotPlan(goal, profile, { siteId: options.siteId });
  const pools = buildPools(rankedEntries);
  const selected = [];
  const steps = [];

  const conflicts = (product) => selected.some((p) => p.product_id === product.product_id || factsConflict(p, product));
  const budgetForIndex = (i) => (i < limits.basic.max ? limits.basic.budgetEur
    : i < limits.optimal.max ? limits.optimal.budgetEur : limits.premium.budgetEur);
  const total = () => selected.reduce((s, p) => s + priceOf(p), 0);

  // 1) Основен продукт.
  const coreCandidates = candidatesForStep(pools, plan[0].slots);
  const core = pickCore(coreCandidates, limits.basic.budgetEur);
  if (core) {
    selected.push(core);
    steps.push({ slot: getProductFacts(core).slot, reason: 'core' });
  }

  // 2) Задължителен по медикамент (напр. CoQ10 при статини) — веднага след основния.
  const must = findMustInclude(profile, rankedEntries);
  if (must && !conflicts(must)) {
    selected.push(must);
    steps.push({ slot: getProductFacts(must).slot, reason: 'medication' });
  }

  // 3) Симптоми и цел, после универсални — докато има място и бюджет.
  // Бюджетът на нивото, в което ще попадне продуктът, е предпочитание (по-евтин от водещите);
  // твърдата граница е бюджетът на премиум нивото.
  const tryStep = (step) => {
    if (selected.length >= limits.premium.max) return;
    const soft = budgetForIndex(selected.length);
    const hard = limits.premium.budgetEur;
    const options = candidatesForStep(pools, step.slots).slice(0, 6)
      .filter((e) => priceOf(e.product) > 0 && !conflicts(e.product));
    const pick = options.find((e) => total() + priceOf(e.product) <= soft)
      || options.find((e) => total() + priceOf(e.product) <= hard);
    if (!pick) return;
    selected.push(pick.product);
    steps.push({ slot: getProductFacts(pick.product).slot, reason: selected.length === 1 ? 'core' : step.reason });
  };
  for (const step of plan.slice(core ? 1 : 0)) tryStep(step);
  if (selected.length < limits.premium.min) {
    for (const slots of UNIVERSAL_STEPS) tryStep({ slots, reason: 'universal' });
  }

  if (selected.length <= 1) {
    return composeAlternatives(profile, rankedEntries, { plan, tierMeta: meta, tierLimits: limits });
  }

  const counts = tierCounts(selected.length, limits);
  const items = selected.map((p, i) => toItem(p, i === 0 ? 'core' : 'support'));
  const premiumItems = items.slice(0, counts.premium);
  // Само 2 продукта → премиум получава по-силен/по-голям основен продукт, за да не повтаря оптималното ниво.
  if (counts.premium === counts.optimal && core) {
    const rest = selected.slice(1, counts.premium);
    const upgrade = coreCandidates.find((e) => e.product.product_id !== core.product_id
      && priceOf(e.product) > priceOf(core)
      && total() - priceOf(core) + priceOf(e.product) <= limits.premium.budgetEur
      && !rest.some((p) => factsConflict(p, e.product)));
    if (upgrade) premiumItems[0] = toItem(upgrade.product, 'core');
  }
  return {
    recommended_tier: 'optimal',
    tiers: {
      basic: { ...meta.basic, products: items.slice(0, counts.basic) },
      optimal: { ...meta.optimal, products: items.slice(0, counts.optimal) },
      premium: { ...meta.premium, products: premiumItems },
    },
    meta: {
      mode: 'slot_plan',
      goal,
      plan: plan.map((s) => s.slots.join('/')),
      picked: steps,
      ranked_pool_size: rankedEntries.length,
      tier_counts: counts,
    },
  };
}
