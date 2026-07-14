/**
 * Витрина на началната страница — per-category (флагът е на продукта в масива products[] на категорията).
 * undefined → показване на началната (обратна съвместимост).
 */
export function isProductOnHomepage(product) {
  return product?.system_data?.show_on_homepage !== false;
}

export function isProductCatalogOnly(product) {
  return product?.system_data?.show_on_homepage === false;
}

export function filterHomepageProducts(products) {
  return (products || []).filter(isProductOnHomepage);
}

export function filterCatalogProducts(products) {
  return (products || []).filter(isProductCatalogOnly);
}

export function sortProductsByDisplayOrder(products) {
  return (products || []).slice().sort((a, b) => {
    const orderA = a.display_order !== undefined ? a.display_order : 999999;
    const orderB = b.display_order !== undefined ? b.display_order : 999999;
    return orderA - orderB;
  });
}

/**
 * Намира product_category компонент по component_id (предпочитано) или category slug/id.
 */
export function findCategoryComponent(pageContent, { categoryId = '', componentId = '' } = {}) {
  const categories = (pageContent || []).filter(
    (c) => c.type === 'product_category' && !c.is_hidden
  );

  if (componentId) {
    const byComponent = categories.find((c) => c.component_id === componentId);
    if (byComponent) return byComponent;
  }

  if (categoryId) {
    return categories.find(
      (c) => c.id === categoryId || c.category_id === categoryId || c.component_id === categoryId
    ) || null;
  }

  return null;
}

export function buildCategoryCatalogUrl(basePage, component, categorySlug) {
  const slug = categorySlug || component?.id || component?.category_id || '';
  const params = new URLSearchParams();
  if (slug) params.set('category', slug);
  if (component?.component_id) params.set('component', component.component_id);
  const qs = params.toString();
  return qs ? `${basePage}?${qs}` : basePage;
}
