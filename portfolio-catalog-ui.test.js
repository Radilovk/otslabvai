import {
  countActiveFilters,
  getRemovableFilterChips,
  shouldShowActiveFilterRow,
  formatFiltersToggleLabel
} from './portfolio-catalog-ui.js';

describe('portfolio-catalog-ui', () => {
  test('countActiveFilters ignores default availability', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ category: 'Протеини' })).toBe(1);
    expect(countActiveFilters({ category: 'Протеини', brand: 'optimum' })).toBe(2);
    expect(countActiveFilters({ availableOnly: false })).toBe(1);
  });

  test('getRemovableFilterChips excludes category', () => {
    const chips = getRemovableFilterChips({
      q: 'whey',
      brand: '749',
      brandLabel: 'Optimum',
      category: 'Протеини'
    });
    expect(chips.map((c) => c.key)).toEqual(['q', 'brand']);
  });

  test('shouldShowActiveFilterRow hides single-criterion state', () => {
    expect(shouldShowActiveFilterRow(0)).toBe(false);
    expect(shouldShowActiveFilterRow(1)).toBe(false);
    expect(shouldShowActiveFilterRow(2)).toBe(true);
  });

  test('formatFiltersToggleLabel', () => {
    expect(formatFiltersToggleLabel(0)).toBe('Филтри');
    expect(formatFiltersToggleLabel(3)).toBe('Филтри (3)');
  });
});
