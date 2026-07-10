import { describe, test, expect } from '@jest/globals';
import { parseCatalogCommand, executeCatalogCommand } from './portfolio-import-command.js';

const meta = {
  brands: [{ id: '1', name: 'Now' }, { id: '2', name: 'Optimum' }],
  categories: [{ name: 'Протеини', count: 2 }, { name: 'Минерали', count: 1 }],
  index: [
    { group_id: '100', name: 'Zinc Plus', brand: 'Now', brand_id: '1', category: 'Минерали', category_top: 'Минерали', min_price: 9.9, max_markup_percent: 35, available: true, search_text: 'zinc цинк now минерали' },
    { group_id: '200', name: 'Whey Gold', brand: 'Optimum', brand_id: '2', category: 'Протеини > Whey', category_top: 'Протеини', min_price: 29.9, max_markup_percent: 22, available: true, search_text: 'whey gold optimum протеини' },
    { group_id: '300', name: 'Creatine', brand: 'Optimum', brand_id: '2', category: 'Протеини', category_top: 'Протеини', min_price: 14.5, max_markup_percent: 18, available: true, search_text: 'creatine optimum протеини' }
  ]
};

describe('parseCatalogCommand', () => {
  test('помощ', () => {
    expect(parseCatalogCommand('помощ', meta).action).toBe('help');
  });

  test('брой', () => {
    expect(parseCatalogCommand('колко продукта от марки 1', meta).action).toBe('count');
  });

  test('статистика', () => {
    expect(parseCatalogCommand('средна цена на протеини', meta).action).toBe('stats');
  });

  test('марки', () => {
    expect(parseCatalogCommand('покажи марките', meta).action).toBe('brands');
  });

  test('списък', () => {
    expect(parseCatalogCommand('изведи продукти съдържащи цинк', meta).action).toBe('list');
  });

  test('AI подбор', () => {
    expect(parseCatalogCommand('фокус върху колаген', meta).action).toBe('select');
  });
});

describe('executeCatalogCommand', () => {
  const baseFilters = { available: '1' };

  test('count връща answer', () => {
    const result = executeCatalogCommand({
      command: { action: 'count', filters: { brands: ['1'] } },
      index: meta.index,
      meta,
      filters: { ...baseFilters, brands: ['1'] },
      limit: 10
    });
    expect(result.answer).toMatch(/1/);
    expect(result.data.count).toBe(1);
  });

  test('list връща продукти и answer', () => {
    const result = executeCatalogCommand({
      command: { action: 'list', filters: { q: 'цинк' } },
      index: meta.index,
      meta,
      filters: { ...baseFilters, q: 'цинк' },
      limit: 10
    });
    expect(result.selected).toHaveLength(1);
    expect(result.answer).toMatch(/Показвам/);
  });

  test('brands връща списък', () => {
    const result = executeCatalogCommand({
      command: { action: 'brands', filters: {} },
      index: meta.index,
      meta,
      filters: baseFilters,
      limit: 10
    });
    expect(result.answer).toMatch(/Now/);
    expect(result.data.brands.length).toBeGreaterThan(0);
  });
});
