/** Shared catalog index filtering – used by API and client cache */
import { matchesSearchQuery, tokenizeQuery } from './portfolio-search.js';

export { matchesSearchQuery, tokenizeQuery, buildSearchText, enrichIndexEntry } from './portfolio-search.js';

/** Filters the index without sorting – reused by filterIndex and by facet counting. */
export function applyFilters(index, params, meta = {}) {
  let results = index;
  const categories = meta.categories || [];

  const brandIds = Array.isArray(params.brands) && params.brands.length
    ? params.brands.map(String)
    : (params.brand ? [String(params.brand)] : []);
  if (brandIds.length) {
    const brandSet = new Set(brandIds);
    results = results.filter((i) => brandSet.has(String(i.brand_id)));
  }
  if (params.category) {
    const cat = params.category;
    results = results.filter(
      (i) => i.category_top === cat || i.category === cat || i.category.startsWith(`${cat} >`)
    );
  }
  if (params.available === '1' || params.available === 'true') {
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
  if (params.min_markup_percent !== '' && params.min_markup_percent != null) {
    const minMarkup = parseFloat(params.min_markup_percent);
    if (!Number.isNaN(minMarkup)) {
      results = results.filter((i) => (i.max_markup_percent ?? i.min_markup_percent ?? 0) >= minMarkup);
    }
  }
  if (params.max_markup_percent !== '' && params.max_markup_percent != null) {
    const maxMarkup = parseFloat(params.max_markup_percent);
    if (!Number.isNaN(maxMarkup)) {
      results = results.filter((i) => (i.min_markup_percent ?? i.max_markup_percent ?? 0) <= maxMarkup);
    }
  }

  return results;
}

export function sortResults(results, sort = 'name') {
  if (sort === 'price_asc') {
    return [...results].sort((a, b) => a.min_price - b.min_price || a.name.localeCompare(b.name, 'bg'));
  }
  if (sort === 'price_desc') {
    return [...results].sort((a, b) => b.max_price - a.max_price || a.name.localeCompare(b.name, 'bg'));
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

  return { categories, brands };
}
