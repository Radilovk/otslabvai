/**
 * Функционални слотове и конфликти в пакет — тънък слой върху advisor-product-facts.js
 * (категории от доставчика → име → конкретни активни вещества), за съвместимост със старите извиквания.
 */
import { getProductFacts, factsConflict, SLOT_META } from './advisor-product-facts.js';
import { buildSlotPlan } from './advisor-composer.js';

export { SLOT_META };

/** Основният функционален слот на продукта. */
export function classifyProductSlot(product) {
  return getProductFacts(product).slot;
}

/** Конфликтни групи: групата на слота + stimulant/thermogenic, ако продуктът е такъв. */
export function getProductConflictGroups(product) {
  const facts = getProductFacts(product);
  const groups = [];
  if (facts.group) groups.push(facts.group);
  if (facts.stimulant) groups.push('stimulant');
  if (facts.thermogenic) groups.push('thermogenic');
  return [...new Set(groups)];
}

export function getSlotMeta(slotId) {
  return SLOT_META[slotId] || SLOT_META.other;
}

/** Ред на слотовете за цел (за работния пул на biocode) — първите слотове от плана. */
export function getGoalSlotOrder(goalId, profile = {}) {
  return buildSlotPlan(goalId, profile).flatMap((step) => step.slots);
}

export function buildStackItemFromSlot(product, slotId) {
  const meta = getSlotMeta(slotId);
  const packaging = product.public_data?.packaging || {};
  const serving = packaging.serving_size || packaging.dose_per_serving;
  return {
    product_id: product.product_id,
    role: 'support',
    dose: serving ? `Според етикета (${serving})` : 'Според етикета',
    timing: meta.timing,
    slot: slotId,
  };
}

export function productsConflictInStack(a, b) {
  return factsConflict(a, b);
}
