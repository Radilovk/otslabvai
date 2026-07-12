/** Shared catalog index filtering – used by API and client cache */
import { matchesSearchQuery, tokenizeQuery } from './portfolio-search.js';

export { matchesSearchQuery, tokenizeQuery, buildSearchText, enrichIndexEntry } from './portfolio-search.js';

/** Filters the index without sorting – reused by filterIndex and by facet counting. */
export function applyFilters(index, params, meta = {}) {
  let results = Array.isArray(index) ? index : [];
  const categories = meta.categories || [];

  if (params.brand) {
    results = results.filter((i) => i.brand_id === params.brand);
  }
  if (params.category) {
    const cat = params.category;
    results = results.filter((i) => {
      const path = i.category || '';
      return i.category_top === cat || path === cat || path.startsWith(`${cat} >`);
    });
  }
  if (params.goal) {
    const goal = params.goal;
    results = results.filter((i) => Array.isArray(i.goals) && i.goals.includes(goal));
  }
  if (params.available === '0' || params.available === 'all' || params.available === 'false') {
    // Admin-only: include unavailable products when explicitly requested.
  } else {
    results = results.filter((i) => i.available);
  }
  if (params.q) {
    results = results.filter((i) => matchesSearchQuery(i, params.q, categories));
  }
  if (params.min_price) {
    const min = parseFloat(params.min_price);
    if (!Number.isNaN(min)) results = results.filter((i) => i.max_price >= min);
  }
  if (params.max_price) {
    const max = parseFloat(params.max_price);
    if (!Number.isNaN(max)) results = results.filter((i) => i.min_price <= max);
  }

  return results;
}

export function compareByMarginDesc(a, b) {
  const marginPctDiff = (b.max_margin_pct ?? 0) - (a.max_margin_pct ?? 0);
  if (marginPctDiff !== 0) return marginPctDiff;
  const marginDiff = (b.max_margin ?? 0) - (a.max_margin ?? 0);
  if (marginDiff !== 0) return marginDiff;
  return a.name.localeCompare(b.name, 'bg');
}

export function sortByMarginDesc(items) {
  return [...items].sort(compareByMarginDesc);
}

export function sortResults(results, sort = 'name') {
  if (sort === 'price_asc') {
    return [...results].sort((a, b) => a.min_price - b.min_price || a.name.localeCompare(b.name, 'bg'));
  }
  if (sort === 'price_desc') {
    return [...results].sort((a, b) => b.max_price - a.max_price || a.name.localeCompare(b.name, 'bg'));
  }
  if (sort === 'margin_desc' || sort === 'relevance') {
    return sortByMarginDesc(results);
  }
  if (sort === 'name_desc') {
    return [...results].sort((a, b) => b.name.localeCompare(a.name, 'bg'));
  }
  if (sort === 'brand') {
    return [...results].sort(
      (a, b) => a.brand.localeCompare(b.brand, 'bg') || a.name.localeCompare(b.name, 'bg')
    );
  }
  if (sort === 'available') {
    return [...results].sort(
      (a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, 'bg')
    );
  }
  return [...results].sort((a, b) => a.name.localeCompare(b.name, 'bg'));
}

export function filterIndex(index, params, meta = {}) {
  return sortResults(applyFilters(index, params, meta), params.sort || 'name');
}

export function paginateIndex(filtered, page = 1, limit = 24) {
  const total = filtered.length;
  const start = (page - 1) * limit;
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit) || 0,
    items: filtered.slice(start, start + limit)
  };
}

/**
 * Faceted category/brand options scoped to the *other* active filters
 * (search, price, availability, and the opposite dimension) — so picking a
 * category hides brands with nothing in it (and shows counts for just that
 * category), and picking a brand hides categories it doesn't carry.
 */
export function computeFacets(index, params, meta = {}) {
  const categoriesMeta = meta.categories || [];
  const brandsMeta = meta.brands || [];
  const goalsMeta = meta.goals || [];

  const forCategoryFacet = applyFilters(index, { ...params, category: '' }, meta);
  const categoryCounts = new Map();
  for (const item of forCategoryFacet) {
    const top = item.category_top || 'Други';
    categoryCounts.set(top, (categoryCounts.get(top) || 0) + 1);
  }
  const categories = categoriesMeta
    .filter((c) => categoryCounts.has(c.name))
    .map((c) => ({ name: c.name, count: categoryCounts.get(c.name) }));

  const forBrandFacet = applyFilters(index, { ...params, brand: '' }, meta);
  const brandCounts = new Map();
  for (const item of forBrandFacet) {
    brandCounts.set(item.brand_id, (brandCounts.get(item.brand_id) || 0) + 1);
  }
  const brands = brandsMeta
    .filter((b) => brandCounts.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, count: brandCounts.get(b.id) }));

  const forGoalFacet = applyFilters(index, { ...params, goal: '' }, meta);
  const goalCounts = new Map();
  for (const item of forGoalFacet) {
    for (const goalId of item.goals || []) {
      goalCounts.set(goalId, (goalCounts.get(goalId) || 0) + 1);
    }
  }
  const goals = goalsMeta
    .filter((g) => goalCounts.has(g.id))
    .map((g) => ({ id: g.id, label: g.label, count: goalCounts.get(g.id) }));

  return { categories, brands, goals };
}
