/** Per-category flag on product in category.products[] — undefined = on homepage (back compat). */
export const isOnHomepage = (p) => p?.system_data?.show_on_homepage !== false;
export const isCatalogOnly = (p) => p?.system_data?.show_on_homepage === false;

export function findCategory(pageContent, categoryId = '', componentId = '') {
  const cats = (pageContent || []).filter((c) => c.type === 'product_category' && !c.is_hidden);
  if (componentId) {
    const hit = cats.find((c) => c.component_id === componentId);
    if (hit) return hit;
  }
  if (categoryId) {
    return cats.find((c) => c.id === categoryId || c.category_id === categoryId) || null;
  }
  return null;
}

export function catalogLink(page, component, slug) {
  const p = new URLSearchParams();
  const id = slug || component?.id || component?.category_id;
  if (id) p.set('category', id);
  if (component?.component_id) p.set('component', component.component_id);
  const qs = p.toString();
  return qs ? `${page}?${qs}` : page;
}

export function sortByOrder(products) {
  return (products || []).slice().sort((a, b) => (a.display_order ?? 999999) - (b.display_order ?? 999999));
}
