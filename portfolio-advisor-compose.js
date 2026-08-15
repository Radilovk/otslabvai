/**
 * Съставяне на пакети / единични продуктови опции за Portfolio AI консултант.
 */

import {
  filterAdvisorRetailProducts,
  pickSingleModeBasicProduct,
  pickSingleModePremiumProduct,
} from './portfolio-advisor-catalog.js';
import {
  buildStackItemFromSlot,
  classifyProductSlot,
  getGoalSlotOrder,
  productsConflictInStack,
} from './portfolio-stack-slots.js';
import { getMustIncludeKeywords, productMatchesAnyKeyword, productSearchText } from './protocol-safety-rules.js';
import { getProductPriceEur } from './protocol-quiz-engine.js';

const UNIVERSAL_SUPPORT_SLOTS = new Set(['foundation', 'minerals', 'omega3', 'herbal', 'immune', 'antioxidant']);

function filterRankedForGoal(rankedEntries, slotOrder) {
  const allowedSlots = new Set(slotOrder);
  return rankedEntries.filter(({ product }) => {
    const slot = classifyProductSlot(product);
    return allowedSlots.has(slot) || UNIVERSAL_SUPPORT_SLOTS.has(slot);
  });
}

function findMustIncludeProducts(profile, ranked) {
  const keywords = getMustIncludeKeywords(profile);
  if (!keywords.length) return [];

  const found = [];
  const seen = new Set();
  for (const { product } of ranked) {
    const text = productSearchText(product);
    if (keywords.some((kw) => productMatchesAnyKeyword(text, [kw])) && !seen.has(product.product_id)) {
      found.push(product);
      seen.add(product.product_id);
    }
  }
  return found;
}

function groupRankedBySlot(rankedEntries) {
  const pools = new Map();
  for (const entry of rankedEntries) {
    const slot = classifyProductSlot(entry.product);
    if (!pools.has(slot)) pools.set(slot, []);
    pools.get(slot).push(entry);
  }
  return pools;
}

function canAddToStack(product, selected, excludeIds) {
  if (excludeIds.has(product.product_id)) return false;
  if (selected.some((p) => p.product_id === product.product_id)) return false;
  return !selected.some((existing) => productsConflictInStack(existing, product));
}

function pickFromSlotPool(pool, rankOffset, selected, excludeIds) {
  if (!pool?.length) return null;
  const available = pool.filter((entry) => canAddToStack(entry.product, selected, excludeIds));
  if (!available.length) return null;
  const idx = Math.min(rankOffset, available.length - 1);
  return available[idx].product;
}

/**
 * Комплементарен стек: по един продукт на функционален слот, без дублиране на активни вещества.
 */
function pickComplementaryStack({
  rankedEntries,
  slotPools,
  slotOrder,
  count,
  minCount,
  budgetEur,
  excludeIds,
  rankOffset,
  mustInclude = [],
}) {
  const selected = [];
  const usedSlots = new Set();
  let totalEur = 0;

  const tryAdd = (product, slot) => {
    if (!canAddToStack(product, selected, excludeIds)) return false;
    const price = getProductPriceEur(product);
    if (selected.length >= 2 && totalEur + price > budgetEur) return false;
    selected.push(product);
    if (slot) usedSlots.add(slot);
    totalEur += price;
    return true;
  };

  for (const product of mustInclude) {
    if (selected.length >= count) break;
    tryAdd(product, classifyProductSlot(product));
  }

  for (const slot of slotOrder) {
    if (selected.length >= count) break;
    if (usedSlots.has(slot)) continue;
    const product = pickFromSlotPool(slotPools.get(slot), rankOffset, selected, excludeIds);
    if (product) tryAdd(product, slot);
  }

  for (const entry of rankedEntries) {
    if (selected.length >= count) break;
    const slot = classifyProductSlot(entry.product);
    if (usedSlots.has(slot) && slot !== 'foundation' && slot !== 'minerals' && slot !== 'herbal') continue;
    tryAdd(entry.product, slot);
  }

  if (selected.length < minCount) {
    for (const entry of rankedEntries) {
      if (selected.length >= minCount) break;
      tryAdd(entry.product, classifyProductSlot(entry.product));
    }
  }

  return selected.slice(0, count);
}

/**
 * Три комплементарни стека — независими при достатъчен pool, иначе споделен pool (без празни tier-ове).
 */
export function composeComplementaryPackageStacks(profile, rankedEntries, options = {}) {
  const limits = options.tierLimits;
  const meta = options.tierMeta || {};
  const goal = profile.priority || 'health';
  const slotOrder = getGoalSlotOrder(goal, profile);
  const eligibleRanked = filterRankedForGoal(rankedEntries, slotOrder);
  const pool = eligibleRanked.length >= 3 ? eligibleRanked : rankedEntries;
  const slotPools = groupRankedBySlot(pool);
  const tierKeys = ['basic', 'optimal', 'premium'];
  const minDistinctNeeded = tierKeys.reduce((sum, k) => sum + limits[k].min, 0);
  const strictIndependent = pool.length >= minDistinctNeeded;
  const globallyUsed = strictIndependent ? new Set() : null;
  const mustInclude = findMustIncludeProducts(profile, pool);

  const tiers = {};

  for (let tierIdx = 0; tierIdx < tierKeys.length; tierIdx += 1) {
    const tierKey = tierKeys[tierIdx];
    const limit = limits[tierKey];
    const excludeIds = strictIndependent ? globallyUsed : new Set();
    const remaining = strictIndependent ? pool.length - globallyUsed.size : limit.max;
    const tierMax = strictIndependent ? Math.min(limit.max, remaining) : limit.max;
    const tierMin = strictIndependent ? Math.min(limit.min, Math.max(remaining, 1)) : 1;
    let products = pickComplementaryStack({
      rankedEntries: pool,
      slotPools,
      slotOrder,
      count: tierMax,
      minCount: strictIndependent ? tierMin : 1,
      budgetEur: limit.budgetEur,
      excludeIds,
      rankOffset: tierIdx,
      mustInclude: tierIdx === 0 ? mustInclude : [],
    });

    if (!products.length) {
      products = pickComplementaryStack({
        rankedEntries: pool,
        slotPools,
        slotOrder,
        count: Math.max(1, limit.min),
        minCount: 1,
        budgetEur: limit.budgetEur,
        excludeIds: new Set(),
        rankOffset: tierIdx,
        mustInclude: [],
      });
    }

    if (strictIndependent) {
      for (const product of products) globallyUsed.add(product.product_id);
    }

    tiers[tierKey] = {
      ...meta[tierKey],
      products: products.map((product) => {
        const slot = classifyProductSlot(product);
        return buildStackItemFromSlot(product, slot);
      }),
    };
  }

  return {
    recommended_tier: 'optimal',
    tiers,
    meta: {
      mode: strictIndependent ? 'complementary_independent' : 'complementary_shared_pool',
      ranked_pool_size: pool.length,
      slot_order: slotOrder,
      distinct_products: strictIndependent
        ? globallyUsed.size
        : new Set(tierKeys.flatMap((k) => tiers[k].products.map((p) => p.product_id))).size,
      tier_counts: {
        basic: tiers.basic.products.length,
        optimal: tiers.optimal.products.length,
        premium: tiers.premium.products.length,
      },
    },
  };
}

/**
 * Единичен продукт: 3 РАЗЛИЧНИ продукта на различни ценови нива и функционални слотове.
 */
export function composeSingleProductOptions(rankedEntries, tierMeta) {
  const candidates = filterAdvisorRetailProducts(
    rankedEntries.map((e) => e.product),
    { selectionMode: 'single' }
  );
  if (!candidates.length) {
    throw new Error('Няма кандидати за единичен продукт.');
  }

  const usedSlots = new Set();
  const usedIds = new Set();
  const picks = { optimal: null, basic: null, premium: null };

  const pickDistinct = (pool, { preferCheapest = false, preferExpensive = false } = {}) => {
    const sorted = [...pool].sort((a, b) => {
      if (preferCheapest) return getProductPriceEur(a) - getProductPriceEur(b);
      if (preferExpensive) return getProductPriceEur(b) - getProductPriceEur(a);
      const scoreA = rankedEntries.find((e) => e.product.product_id === a.product_id)?.score || 0;
      const scoreB = rankedEntries.find((e) => e.product.product_id === b.product_id)?.score || 0;
      return scoreB - scoreA;
    });

    for (const product of sorted) {
      if (usedIds.has(product.product_id)) continue;
      const slot = classifyProductSlot(product);
      if (usedSlots.has(slot) && slot !== 'foundation') continue;
      usedIds.add(product.product_id);
      usedSlots.add(slot);
      return product;
    }
    return sorted.find((p) => !usedIds.has(p.product_id)) || null;
  };

  picks.optimal = pickDistinct(candidates);
  picks.basic = pickDistinct(candidates, { preferCheapest: true }) || picks.optimal;
  picks.premium = pickDistinct(candidates, { preferExpensive: true }) || picks.optimal;

  if (!picks.optimal) throw new Error('Няма кандидати за единичен продукт.');

  const ensureDistinct = () => {
    const ids = new Set([picks.optimal?.product_id, picks.basic?.product_id, picks.premium?.product_id]);
    if (ids.size >= 3 || candidates.length < 3) return;

    const unused = candidates.filter((p) => !ids.has(p.product_id));
    if (!unused.length) return;

    if (picks.basic?.product_id === picks.optimal?.product_id) {
      picks.basic = pickSingleModeBasicProduct(unused) || unused[0];
      usedIds.add(picks.basic.product_id);
    }
    if (picks.premium?.product_id === picks.optimal?.product_id || picks.premium?.product_id === picks.basic?.product_id) {
      const pool = candidates.filter((p) => p.product_id !== picks.optimal?.product_id && p.product_id !== picks.basic?.product_id);
      picks.premium = pickSingleModePremiumProduct(pool) || pool[0] || picks.premium;
    }
  };

  ensureDistinct();

  const toItem = (product) => {
    const slot = classifyProductSlot(product);
    return buildStackItemFromSlot(product, slot);
  };

  return {
    recommended_tier: 'optimal',
    tiers: {
      basic: { ...tierMeta.basic, products: [toItem(picks.basic || picks.optimal)] },
      optimal: { ...tierMeta.optimal, products: [toItem(picks.optimal)] },
      premium: { ...tierMeta.premium, products: [toItem(picks.premium || picks.optimal)] },
    },
    meta: {
      mode: 'single',
      ranked_pool_size: candidates.length,
      distinct_products: new Set([picks.basic?.product_id, picks.optimal?.product_id, picks.premium?.product_id]).size,
      tier_product_ids: {
        basic: picks.basic?.product_id,
        optimal: picks.optimal?.product_id,
        premium: picks.premium?.product_id,
      },
    },
  };
}

export function composePortfolioAdvisorStacks(profile, rankedEntries, options = {}) {
  if (profile.selection_mode === 'single') {
    return composeSingleProductOptions(rankedEntries, options.tierMeta || {});
  }
  return composeComplementaryPackageStacks(profile, rankedEntries, options);
}
