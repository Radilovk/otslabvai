import { jest } from '@jest/globals';
import {
  ADVISOR_STEPS,
  FALLBACK_CATALOG_CATEGORIES,
  MAX_ADVISOR_CATEGORIES,
  buildCategoryStep,
  buildActiveAdvisorSteps,
  filterCategoriesForAdvisor,
  getDefaultAdvisorCategoryNames,
  pruneAdvisorAnswers,
} from './portfolio-advisor-config.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';
import { buildPortfolioAdvisorProfile, normalizeAdvisorCategories } from './portfolio-advisor-engine.js';

describe('portfolio-advisor-config', () => {
  test('priority options match PORTFOLIO_GOALS ids', () => {
    const priorityStep = ADVISOR_STEPS.find((s) => s.field === 'priority');
    const optionIds = priorityStep.options.filter((o) => o.value !== 'other').map((o) => o.value);
    expect(optionIds).toEqual(PORTFOLIO_GOALS.map((g) => g.id));
  });

  test('buildCategoryStep uses goal-filtered categories without „Всички категории“', () => {
    const catalog = [
      { name: 'Протеини', count: 12 },
      { name: 'Отслабване', count: 8 },
      { name: 'Аксесоари', count: 20 },
      { name: 'Гейнъри', count: 5 },
    ];
    const step = buildCategoryStep(catalog, { priority: 'otshalvane' });
    expect(step.id).toBe('product_categories');
    expect(step.type).toBe('multi');
    expect(step.options.some((o) => o.value === 'all')).toBe(false);
    expect(step.options.some((o) => o.value === 'Аксесоари')).toBe(false);
    expect(step.options.some((o) => o.value === 'Гейнъри')).toBe(false);
    expect(step.options.some((o) => o.value === 'Отслабване')).toBe(true);
  });

  test('filterCategoriesForAdvisor caps at MAX_ADVISOR_CATEGORIES', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Витамин ${i}`, count: i + 1 }));
    const filtered = filterCategoriesForAdvisor(many, 'health');
    expect(filtered.length).toBeLessThanOrEqual(MAX_ADVISOR_CATEGORIES);
  });

  test('buildCategoryStep falls back when catalog empty', () => {
    const step = buildCategoryStep([], { priority: 'muscle' });
    expect(step.options.length).toBeGreaterThan(0);
    expect(step.options.length).toBeLessThanOrEqual(MAX_ADVISOR_CATEGORIES);
  });

  test('buildCategoryStep single mode е radio без „Всички категории“', () => {
    const step = buildCategoryStep([{ name: 'Протеини' }, { name: 'Аксесоари' }], { singleSelect: true, priority: 'muscle' });
    expect(step.type).toBe('single');
    expect(step.field).toBe('product_category');
    expect(step.options.some((o) => o.value === 'all')).toBe(false);
    expect(step.options.some((o) => o.value === 'Аксесоари')).toBe(false);
    expect(step.options.some((o) => o.value === 'Протеини')).toBe(true);
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

  test('buildActiveAdvisorSteps няма отделна стъпка за бременност', () => {
    const steps = buildActiveAdvisorSteps({ priority: 'health', sex: 'female' });
    expect(steps.some((s) => s.id === 'pregnancy')).toBe(false);
  });

  test('conditions включва бременност/кърмене само при жена', () => {
    const female = buildActiveAdvisorSteps({ sex: 'female' }).find((s) => s.id === 'conditions');
    const male = buildActiveAdvisorSteps({ sex: 'male' }).find((s) => s.id === 'conditions');
    expect(female.options.some((o) => o.value === 'pregnancy')).toBe(true);
    expect(female.options.some((o) => o.value === 'breastfeeding')).toBe(true);
    expect(male.options.some((o) => o.value === 'pregnancy')).toBe(false);
  });

  test('medications скрива хормонална терапия при мъж', () => {
    const male = buildActiveAdvisorSteps({ sex: 'male' }).find((s) => s.id === 'medications');
    const female = buildActiveAdvisorSteps({ sex: 'female' }).find((s) => s.id === 'medications');
    expect(male.options.some((o) => o.value === 'hormone_therapy')).toBe(false);
    expect(female.options.some((o) => o.value === 'hormone_therapy')).toBe(true);
  });

  test('body стъпка само при отслабване или мускулна маса', () => {
    expect(buildActiveAdvisorSteps({ priority: 'otshalvane' }).some((s) => s.id === 'body')).toBe(true);
    expect(buildActiveAdvisorSteps({ priority: 'muscle' }).some((s) => s.id === 'body')).toBe(true);
    expect(buildActiveAdvisorSteps({ priority: 'health' }).some((s) => s.id === 'body')).toBe(false);
  });

  test('pruneAdvisorAnswers премахва женски отговори при мъж', () => {
    const answers = {
      sex: 'male',
      conditions: ['pregnancy', 'hypertension'],
      medications: ['hormone_therapy', 'statins'],
      pregnancy: 'yes',
      height_cm: 180,
      weight_kg: 80,
      priority: 'health',
    };
    pruneAdvisorAnswers(answers);
    expect(answers.conditions).toEqual(['hypertension']);
    expect(answers.medications).toEqual(['statins']);
    expect(answers.pregnancy).toBeUndefined();
    expect(answers.height_cm).toBeUndefined();
  });

  test('getDefaultAdvisorCategoryNames връща релевантни имена за целта', () => {
    const catalog = [
      { name: 'Протеини', count: 10 },
      { name: 'Отслабване', count: 8 },
      { name: 'Аксесоари', count: 5 },
    ];
    const names = getDefaultAdvisorCategoryNames(catalog, 'otshalvane');
    expect(names).toContain('Отслабване');
    expect(names).not.toContain('Аксесоари');
    expect(names).not.toContain('Протеини');
  });
});
