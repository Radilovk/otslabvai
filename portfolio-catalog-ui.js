/** Pure UI helpers for catalog filters – unit-testable without DOM. */

export function countActiveFilters({
  q = '',
  category = '',
  brand = '',
  min_price = '',
  max_price = '',
  availableOnly = true
} = {}) {
  let n = 0;
  if (String(q).trim()) n++;
  if (category) n++;
  if (brand) n++;
  if (min_price || max_price) n++;
  if (!availableOnly) n++;
  return n;
}

export function getRemovableFilterChips({
  q = '',
  brand = '',
  brandLabel = '',
  min_price = '',
  max_price = '',
  availableOnly = true
} = {}) {
  const chips = [];
  const query = String(q).trim();
  if (query) chips.push({ key: 'q', label: `„${query}"` });
  if (brand) chips.push({ key: 'brand', label: brandLabel || brand });
  if (min_price || max_price) {
    const from = min_price || '0';
    const to = max_price || '∞';
    chips.push({ key: 'price', label: `${from}–${to} €` });
  }
  if (!availableOnly) chips.push({ key: 'available', label: 'Вкл. изчерпани' });
  return chips;
}

export function shouldShowActiveFilterRow(totalActive) {
  return totalActive > 1;
}

export function formatFiltersToggleLabel(totalActive) {
  return totalActive > 0 ? `Филтри (${totalActive})` : 'Филтри';
}
