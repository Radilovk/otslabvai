import { describe, test, expect } from '@jest/globals';
import {
  parseAiSelectPrompt,
  hasStructuredFilters,
  buildFilterReason,
  mergeImportFilters
} from './portfolio-import-prompt.js';

const meta = {
  brands: [
    { id: '1', name: 'Optimum Nutrition' },
    { id: '2', name: 'Now Foods' }
  ]
};

describe('parseAiSelectPrompt', () => {
  test('парсира марки по ID', () => {
    const result = parseAiSelectPrompt('изведи продукти само от марките 1, 2, 3', meta);
    expect(result.mode).toBe('filter');
    expect(result.filters.brands).toEqual(['1', '2', '3']);
  });

  test('парсира марж над процент', () => {
    const result = parseAiSelectPrompt('изведи продукти с продажна цена над 30% от базовата', meta);
    expect(result.mode).toBe('filter');
    expect(result.filters.min_markup_percent).toBe(30);
  });

  test('парсира съставка (цинк)', () => {
    const result = parseAiSelectPrompt('изведи продукти, които съдържат цинк', meta);
    expect(result.mode).toBe('filter');
    expect(result.filters.q).toMatch(/цинк/i);
  });

  test('тематичен prompt остава за AI', () => {
    const result = parseAiSelectPrompt('фокус върху колаген и NAD+', meta);
    expect(result.mode).toBe('select');
    expect(result.aiInstructions).toContain('колаген');
  });

  test('ценови диапазон', () => {
    const result = parseAiSelectPrompt('покажи продукти с цена над 20 евро', meta);
    expect(result.filters.min_price).toBe('20');
  });
});

describe('mergeImportFilters', () => {
  test('слива UI марка и парснати марки', () => {
    const merged = mergeImportFilters({
      ui: { brand: '5', q: 'протеин' },
      parsed: { brands: ['1', '2'], min_markup_percent: 25 }
    });
    expect(merged.brands).toEqual(expect.arrayContaining(['5', '1', '2']));
    expect(merged.q).toBe('протеин');
    expect(merged.min_markup_percent).toBe(25);
  });
});

describe('buildFilterReason', () => {
  test('описва приложените критерии', () => {
    const reason = buildFilterReason({ brands: ['1', '2'], q: 'цинк', min_markup_percent: 30 });
    expect(reason).toContain('марки 1, 2');
    expect(reason).toContain('цинк');
    expect(reason).toContain('30%');
  });
});

describe('hasStructuredFilters', () => {
  test('разпознава структурирани филтри', () => {
    expect(hasStructuredFilters({ brands: ['1'] })).toBe(true);
    expect(hasStructuredFilters({})).toBe(false);
  });
});
