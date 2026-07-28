import { jest } from '@jest/globals';
import {
  ADVISOR_STEPS,
  FALLBACK_CATALOG_CATEGORIES,
  buildCategoryStep,
  buildActiveAdvisorSteps,
} from './portfolio-advisor-config.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';
import { buildPortfolioAdvisorProfile, normalizeAdvisorCategories } from './portfolio-advisor-engine.js';

describe('portfolio-advisor-config', () => {
  test('priority options match PORTFOLIO_GOALS ids', () => {
    const priorityStep = ADVISOR_STEPS.find((s) => s.field === 'priority');
    const optionIds = priorityStep.options.filter((o) => o.value !== 'other').map((o) => o.value);
    expect(optionIds).toEqual(PORTFOLIO_GOALS.map((g) => g.id));
  });

  test('buildCategoryStep uses catalog categories with counts', () => {
    const step = buildCategoryStep([{ name: 'Протеини', count: 12 }, { name: 'Витамини', count: 5 }]);
    expect(step.id).toBe('product_categories');
    expect(step.type).toBe('multi');
    expect(step.options[0]).toEqual({ value: 'all', label: 'Всички категории', exclusive: true });
    expect(step.options.find((o) => o.value === 'Протеини')?.label).toBe('Протеини (12)');
  });

  test('buildCategoryStep falls back when catalog empty', () => {
    const step = buildCategoryStep([]);
    expect(step.options.length).toBeGreaterThan(FALLBACK_CATALOG_CATEGORIES.length);
  });

  test('buildCategoryStep single mode е radio без „Всички категории“', () => {
    const step = buildCategoryStep([{ name: 'Протеини' }], { singleSelect: true });
    expect(step.type).toBe('single');
    expect(step.field).toBe('product_category');
    expect(step.options.some((o) => o.value === 'all')).toBe(false);
  });

  test('buildActiveAdvisorSteps inserts category step right after priority', () => {
    const packageSteps = buildActiveAdvisorSteps({ priority: 'muscle', sex: 'male', selection_mode: 'package' }, [{ name: 'Протеини' }]);
    const singleSteps = buildActiveAdvisorSteps({ priority: 'muscle', sex: 'male', selection_mode: 'single' }, [{ name: 'Протеини' }]);
    const priorityIdx = packageSteps.findIndex((s) => s.field === 'priority');
    expect(packageSteps[priorityIdx + 1]?.field).toBe('product_categories');
    expect(singleSteps[priorityIdx + 1]?.field).toBe('product_category');
  });

  test('normalizeAdvisorCategories single mode взима една категория', () => {
    expect(normalizeAdvisorCategories({ selection_mode: 'single', product_category: 'Витамини' })).toEqual(['Витамини']);
    expect(buildPortfolioAdvisorProfile({
      selection_mode: 'single',
      product_category: 'Протеини',
      email: 'a@b.com',
      priority: 'muscle',
    }).product_categories).toEqual(['Протеини']);
  });

  test('buildActiveAdvisorSteps adds pregnancy for female', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'health', sex: 'female' });
    expect(steps.some((s) => s.id === 'pregnancy')).toBe(true);
  });
});
