/** Pure UI helpers for catalog filters – unit-testable without DOM. */

export function countActiveFilters({
  q = '',
  category = '',
  goal = '',
  brand = '',
  min_price = '',
  max_price = ''
} = {}) {
  let n = 0;
  if (String(q).trim()) n++;
  if (category) n++;
  if (goal) n++;
  if (brand) n++;
  if (min_price || max_price) n++;
  return n;
}

export function getRemovableFilterChips({
  q = '',
  category = '',
  categoryLabel = '',
  goal = '',
  goalLabel = '',
  brand = '',
  brandLabel = '',
  min_price = '',
  max_price = ''
} = {}) {
  const chips = [];
  const query = String(q).trim();
  if (query) chips.push({ key: 'q', label: `„${query}"` });
  if (category) chips.push({ key: 'category', label: categoryLabel || category });
  if (goal) chips.push({ key: 'goal', label: goalLabel || goal });
  if (brand) chips.push({ key: 'brand', label: brandLabel || brand });
  if (min_price || max_price) {
    const from = min_price || '0';
    const to = max_price || '∞';
    chips.push({ key: 'price', label: `${from}–${to} €` });
  }
  return chips;
}

export function shouldShowActiveFilterRow(totalActive) {
  return totalActive > 1;
}

export function formatFiltersToggleLabel(totalActive) {
  return totalActive > 0 ? `Филтри (${totalActive})` : 'Филтри';
}
