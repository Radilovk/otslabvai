/**
 * Споделена логика за витрина на началната страница (main + life).
 * undefined → показване на началната (обратна съвместимост).
 */
export function isProductOnHomepage(product) {
  return product?.system_data?.show_on_homepage !== false;
}
