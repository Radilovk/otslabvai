/** Shared catalog index filtering – used by API and client cache */

export function filterIndex(index, params) {
  let results = index;

  if (params.brand) {
    results = results.filter((i) => i.brand_id === params.brand);
  }
  if (params.category) {
    results = results.filter(
      (i) => i.category_top === params.category || i.category.startsWith(params.category)
    );
  }
  if (params.available === '1' || params.available === 'true') {
    results = results.filter((i) => i.available);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    results = results.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.brand.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
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
    results = [...results].sort((a, b) => a.min_price - b.min_price);
  } else if (sort === 'price_desc') {
    results = [...results].sort((a, b) => b.max_price - a.max_price);
  } else if (sort === 'brand') {
    results = [...results].sort((a, b) => a.brand.localeCompare(b.brand, 'bg'));
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
