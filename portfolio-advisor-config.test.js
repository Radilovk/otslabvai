import { jest } from '@jest/globals';
import {
  ADVISOR_STEPS,
  FALLBACK_CATALOG_CATEGORIES,
  DEFAULT_ADVISOR_SEARCH_CATEGORIES,
  buildCategoryStep,
  buildActiveAdvisorSteps,
  filterCategoriesForAdvisor,
  splitAdvisorCategories,
  scoreCategoryForGoal,
  getDefaultAdvisorCategoryNames,
  getRelevantAdvisorCategoryNames,
  pruneAdvisorAnswers,
} from './portfolio-advisor-config.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';
import { buildPortfolioAdvisorProfile, normalizeAdvisorCategories } from './portfolio-advisor-engine.js';

/** Реални Fitness1 категории за тестове */
const REAL_CATALOG = [
  { name: 'Витамини', count: 287 },
  { name: 'Изгаряне на мазнини', count: 191 },
  { name: 'Билки', count: 415 },
  { name: 'Аминокиселини', count: 248 },
  { name: 'Протеини', count: 120 },
  { name: 'Креатин', count: 100 },
  { name: 'Минерали', count: 237 },
  { name: 'Мастни киселини', count: 116 },
  { name: 'Антиоксиданти', count: 174 },
  { name: 'Здраве и тонус', count: 369 },
  { name: 'Спортни аксесоари и уреди', count: 210 },
  { name: 'Качване на маса и възстановяване', count: 86 },
  { name: 'Предтренировъчни добавки', count: 126 },
  { name: 'Anti-Aging / Против стареене', count: 37 },
  { name: 'Стави и сухожилия', count: 151 },
  { name: 'Хардкор продукти и стимулатори', count: 99 },
];

describe('portfolio-advisor-config', () => {
  test('priority options match PORTFOLIO_GOALS ids', () => {
    const priorityStep = ADVISOR_STEPS.find((s) => s.field === 'priority');
    const optionIds = priorityStep.options.filter((o) => o.value !== 'other').map((o) => o.value);
    expect(optionIds).toEqual(PORTFOLIO_GOALS.map((g) => g.id));
  });

  test('scoreCategoryForGoal разпознава „Изгаряне на мазнини“ при отслабване', () => {
    expect(scoreCategoryForGoal('Изгаряне на мазнини', 'otshalvane')).toBeGreaterThan(
      scoreCategoryForGoal('Витамини', 'otshalvane')
    );
    expect(scoreCategoryForGoal('Билки', 'otshalvane')).toBeGreaterThan(0);
    expect(scoreCategoryForGoal('Протеини', 'otshalvane')).toBe(-1);
  });

  test('filterCategoriesForAdvisor подрежда по релевантност, не само по count', () => {
    const filtered = filterCategoriesForAdvisor(REAL_CATALOG, 'otshalvane');
    expect(filtered[0].name).toBe('Изгаряне на мазнини');
    expect(filtered.some((c) => c.name === 'Протеини')).toBe(false);
    expect(filtered.some((c) => c.name === 'Спортни аксесоари и уреди')).toBe(false);
  });

  test('getDefaultAdvisorCategoryNames маркира топ 3 по приоритет при отслабване', () => {
    const names = getDefaultAdvisorCategoryNames(REAL_CATALOG, 'otshalvane');
    expect(names).toHaveLength(DEFAULT_ADVISOR_SEARCH_CATEGORIES);
    expect(names[0]).toBe('Изгаряне на мазнини');
    expect(names).toContain('Билки');
    expect(names).toContain('Аминокиселини');
    expect(names).not.toContain('Витамини');
    expect(names).not.toContain('Протеини');
  });

  test('buildCategoryStep uses goal-filtered categories without аксесоари', () => {
    const step = buildCategoryStep(REAL_CATALOG, { priority: 'otshalvane' });
    expect(step.id).toBe('product_categories');
    expect(step.type).toBe('category_multi');
    expect(step.primaryOptions[0]?.value).toBe('Изгаряне на мазнини');
    expect(step.primaryOptions.some((o) => o.value === 'Спортни аксесоари и уреди')).toBe(false);
    expect(step.moreOptions.some((o) => o.value === 'Протеини')).toBe(false);
  });

  test('filterCategoriesForAdvisor връща всички релевантни категории за здраве', () => {
    const filtered = filterCategoriesForAdvisor(REAL_CATALOG, 'health');
    expect(filtered.length).toBeGreaterThan(DEFAULT_ADVISOR_SEARCH_CATEGORIES);
    expect(filtered.some((c) => c.name === 'Витамини')).toBe(true);
    expect(filtered.some((c) => c.name === 'Протеини')).toBe(false);
  });

  test('splitAdvisorCategories разделя топ 3 и останалите', () => {
    const catalog = REAL_CATALOG.filter((c) => c.name !== 'Спортни аксесоари и уреди');
    const { all, primary, more } = splitAdvisorCategories(catalog, 'other');
    expect(all.length).toBeGreaterThan(DEFAULT_ADVISOR_SEARCH_CATEGORIES);
    expect(primary).toHaveLength(DEFAULT_ADVISOR_SEARCH_CATEGORIES);
    expect(more.length).toBe(all.length - DEFAULT_ADVISOR_SEARCH_CATEGORIES);
  });

  test('buildCategoryStep falls back when catalog empty', () => {
    const step = buildCategoryStep([], { priority: 'muscle' });
    expect(step.primaryOptions.length).toBeGreaterThan(0);
    const topValues = step.primaryOptions.map((o) => o.value);
    expect(topValues).toContain('Протеини');
    expect(topValues).toContain('Креатин');
  });

  test('buildCategoryStep single mode е radio без аксесоари', () => {
    const step = buildCategoryStep(REAL_CATALOG, { singleSelect: true, priority: 'muscle' });
    expect(step.type).toBe('category_single');
    expect(step.field).toBe('product_category');
    const allOptions = [...step.primaryOptions, ...step.moreOptions];
    expect(allOptions.some((o) => o.value === 'Спортни аксесоари и уреди')).toBe(false);
    expect(allOptions.some((o) => o.value === 'Протеини')).toBe(true);
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

  test('getRelevantAdvisorCategoryNames връща всички релевантни', () => {
    const names = getRelevantAdvisorCategoryNames(REAL_CATALOG, 'otshalvane');
    expect(names.length).toBeGreaterThan(DEFAULT_ADVISOR_SEARCH_CATEGORIES);
    expect(names).not.toContain('Спортни аксесоари и уреди');
    expect(names).not.toContain('Протеини');
    expect(names[0]).toBe('Изгаряне на мазнини');
  });

  test('muscle goal: топ 3 са Протеини, Креатин, Качване на маса', () => {
    const names = getDefaultAdvisorCategoryNames(REAL_CATALOG, 'muscle');
    expect(names[0]).toBe('Протеини');
    expect(names).toContain('Креатин');
    expect(names).toContain('Качване на маса и възстановяване');
    expect(names).not.toContain('Изгаряне на мазнини');
  });

  test('FALLBACK_CATALOG_CATEGORIES съдържа реални Fitness1 категории', () => {
    expect(FALLBACK_CATALOG_CATEGORIES).toContain('Изгаряне на мазнини');
    expect(FALLBACK_CATALOG_CATEGORIES).toContain('Протеини');
    const fallbackFiltered = filterCategoriesForAdvisor(
      FALLBACK_CATALOG_CATEGORIES.map((name) => ({ name })),
      'otshalvane'
    );
    expect(fallbackFiltered[0]?.name).toBe('Изгаряне на мазнини');
  });
});
