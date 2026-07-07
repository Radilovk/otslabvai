/** Shared catalog index filtering – used by API and client cache */
import { matchesSearchQuery, tokenizeQuery } from './portfolio-search.js';

export { matchesSearchQuery, tokenizeQuery, buildSearchText, enrichIndexEntry } from './portfolio-search.js';

export function filterIndex(index, params, meta = {}) {
  let results = index;
  const categories = meta.categories || [];

  if (params.brand) {
    results = results.filter((i) => i.brand_id === params.brand);
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

  const sort = params.sort || 'name';
  if (sort === 'price_asc') {
    results = [...results].sort((a, b) => a.min_price - b.min_price || a.name.localeCompare(b.name, 'bg'));
  } else if (sort === 'price_desc') {
    results = [...results].sort((a, b) => b.max_price - a.max_price || a.name.localeCompare(b.name, 'bg'));
  } else if (sort === 'name_desc') {
    results = [...results].sort((a, b) => b.name.localeCompare(a.name, 'bg'));
  } else if (sort === 'brand') {
    results = [...results].sort(
      (a, b) => a.brand.localeCompare(b.brand, 'bg') || a.name.localeCompare(b.name, 'bg')
    );
  } else if (sort === 'available') {
    results = [...results].sort(
      (a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, 'bg')
    );
  } else {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name, 'bg'));
  }

  return results;
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
