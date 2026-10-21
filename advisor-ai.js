/**
 * Общ AI слой за трите консултанта.
 *   - Алгоритъмът винаги съставя пакетите първи (advisor-composer.js).
 *   - AI получава компактни карти на продуктите (слот, активни съставки, стимулант, прием, цена),
 *     профил без лични данни и готовите пакети; при сложен клиничен профил може да сменя продукти
 *     само с алтернативи от списъка.
 *   - Отговорът на AI се поправя: непознати/изключени/конфликтни продукти отпадат, бройките се спазват,
 *     липсващото се допълва от пакетите на алгоритъма.
 */
import { getProductFacts, factsConflict, SLOT_META } from './advisor-product-facts.js';
import { getPackDaysSupply } from './protocol-quiz-engine.js';

/** Полета на профила, които AI вижда. Без имейл, име и други лични данни. */
const AI_PROFILE_FIELDS = [
  'sex', 'age_band', 'bmi', 'priority', 'priority_other', 'activity', 'diet', 'diet_other',
  'conditions', 'conditions_other', 'medications', 'medications_other', 'allergies', 'allergies_other',
  'symptoms', 'symptoms_other', 'pregnancy', 'menopause_context', 'stimulant_tolerance', 'weight_goal',
  'budget_band', 'selection_mode', 'product_categories',
];

export function sanitizeProfileForAI(profile = {}) {
  const out = {};
  for (const key of AI_PROFILE_FIELDS) {
    const value = profile[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      const list = value.filter((v) => v && v !== 'none');
      if (list.length) out[key] = list;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function shortText(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Компактна карта на продукт за AI — достатъчно за клинично решение, без излишни токени. */
export function buildProductCard(product) {
  const facts = getProductFacts(product);
  const pd = product.public_data || {};
  const ingredients = (pd.ingredients || []).map((i) => i?.name).filter(Boolean).slice(0, 6);
  const categoryLeaf = String(product.system_data?.portfolio?.category || '').split('>').pop()?.trim();
  const card = {
    id: product.product_id,
    name: shortText(pd.name, 90),
    role: SLOT_META[facts.slot]?.label || facts.slot,
    eur: Math.round((facts.price || 0) * 100) / 100,
  };
  const days = getPackDaysSupply(product, facts.variant);
  if (days) card.days = days;
  if (facts.stimulant) card.stimulant = true;
  if (facts.gender) card.for = facts.gender === 'male' ? 'мъже' : 'жени';
  if (ingredients.length) card.actives = ingredients;
  else if (categoryLeaf) card.category = categoryLeaf;
  if (pd.recommended_intake) card.intake = shortText(pd.recommended_intake, 120);
  const serving = pd.packaging?.serving_size || pd.packaging?.dose_per_serving;
  if (serving) card.serving = shortText(serving, 60);
  return card;
}

/**
 * Кандидати за AI преглед: продуктите от пакетите + до `perSlot` алтернативи от същия слот
 * (подредени по релевантност → печалба). AI не вижда нищо извън този списък.
 */
export function buildReviewCandidates(composed, rankedEntries, { perSlot = 2, max = 24 } = {}) {
  const picked = [];
  const seen = new Set();
  const add = (product) => {
    if (!product || seen.has(product.product_id) || picked.length >= max) return;
    seen.add(product.product_id);
    picked.push(product);
  };
  const byId = new Map(rankedEntries.map((e) => [e.product.product_id, e.product]));
  const stackIds = new Set();
  for (const key of ['basic', 'optimal', 'premium']) {
    for (const item of composed.tiers[key].products) stackIds.add(item.product_id);
  }
  for (const id of stackIds) add(byId.get(id));
  for (const id of stackIds) {
    const slot = byId.get(id) ? getProductFacts(byId.get(id)).slot : null;
    if (!slot) continue;
    let count = 0;
    for (const { product } of rankedEntries) {
      if (count >= perSlot) break;
      if (seen.has(product.product_id)) continue;
      if (getProductFacts(product).slot !== slot) continue;
      add(product);
      count += 1;
    }
  }
  return picked;
}

/** Пакетите на алгоритъма във вид за AI (само id-та по нива). */
export function summarizeComposedForAI(composed) {
  const out = {};
  for (const key of ['basic', 'optimal', 'premium']) {
    out[key] = composed.tiers[key].products.map((item) => item.product_id);
  }
  return out;
}

function baseItem(product, role) {
  const facts = getProductFacts(product);
  return {
    product_id: product.product_id,
    role,
    slot: facts.slot,
    dose: 'Според етикета',
    timing: SLOT_META[facts.slot]?.timing || 'според етикета',
  };
}

/**
 * Поправя AI отговор (режим „преглед“): допуска само продукти от `productMap`, без дубли и конфликти,
 * бройки в границите на нивото; липсващото — от пакетите на алгоритъма.
 * @param {object} response - JSON от AI ({ tiers: { basic: { products: [...] } … } … })
 * @param {object} composed - пакетите на алгоритъма
 * @param {Map<string, object>} productMap - позволените продукти (кандидатите)
 * @param {object} limits - { basic: { min, max }, … }
 */
export function repairAiTiers(response, composed, productMap, limits) {
  const fixed = { ...(response || {}), tiers: {} };
  const changes = [];
  for (const key of ['basic', 'optimal', 'premium']) {
    const aiTier = response?.tiers?.[key] || {};
    const base = composed.tiers[key];
    const out = [];
    const conflicts = (product) => out.some((item) => {
      const other = productMap.get(item.product_id);
      return item.product_id === product.product_id || (other && factsConflict(other, product));
    });
    for (const item of Array.isArray(aiTier.products) ? aiTier.products : []) {
      const product = productMap.get(item?.product_id);
      if (!product) {
        changes.push(`${key}: махнат непознат продукт ${item?.product_id}`);
        continue;
      }
      if (conflicts(product)) {
        changes.push(`${key}: махнат конфликтен/повторен ${item.product_id}`);
        continue;
      }
      out.push({
        ...baseItem(product, out.length === 0 ? 'core' : 'support'),
        ...(item.why_for_you ? { why_for_you: String(item.why_for_you) } : {}),
      });
    }
    const min = Math.min(limits?.[key]?.min ?? 1, base.products.length);
    const max = limits?.[key]?.max ?? base.products.length;
    // Продукт, който AI е махнал от пакета на алгоритъма (напр. омега-3 при „Друго: варфарин“),
    // не се връща при допълването — иначе прегледът за сложен профил губи смисъл.
    // Само ако AI е дал поне един валиден продукт — иначе списъкът му е счупен и не означава „махни“.
    const aiValid = out.length > 0;
    const aiIds = new Set((Array.isArray(aiTier.products) ? aiTier.products : []).map((i) => i?.product_id));
    const removedByAi = (pid) => aiValid && !aiIds.has(pid);
    for (const item of base.products) {
      if (out.length >= Math.max(min, 1)) break;
      const product = productMap.get(item.product_id);
      if (!product || conflicts(product) || removedByAi(item.product_id)) continue;
      out.push({ ...item });
      changes.push(`${key}: допълнен от алгоритъма ${item.product_id}`);
    }
    fixed.tiers[key] = {
      ...base,
      ...aiTier,
      name: aiTier.name || base.name,
      tagline: aiTier.tagline || base.tagline,
      products: out.slice(0, max),
    };
  }
  if (!['basic', 'optimal', 'premium'].includes(fixed.recommended_tier)) {
    fixed.recommended_tier = composed.recommended_tier || 'optimal';
  }
  return { response: fixed, changes };
}
