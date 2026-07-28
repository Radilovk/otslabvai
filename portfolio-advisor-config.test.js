import { jest } from '@jest/globals';
import {
  ADVISOR_STEPS,
  FALLBACK_CATALOG_CATEGORIES,
  buildCategoryStep,
  buildActiveAdvisorSteps,
} from './portfolio-advisor-config.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';

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

  test('buildActiveAdvisorSteps inserts category step right after priority', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'muscle', sex: 'male' }, [{ name: 'Протеини' }]);
    const priorityIdx = steps.findIndex((s) => s.field === 'priority');
    expect(steps[priorityIdx + 1]?.id).toBe('product_categories');
    expect(steps.findIndex((s) => s.field === 'activity')).toBeGreaterThan(priorityIdx);
  });

  test('buildActiveAdvisorSteps adds pregnancy for female', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'health', sex: 'female' });
    expect(steps.some((s) => s.id === 'pregnancy')).toBe(true);
  });
});
