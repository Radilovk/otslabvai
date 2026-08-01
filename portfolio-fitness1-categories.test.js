import {
  FITNESS1_CATALOG_CATEGORIES,
  FITNESS1_EXCLUDED_CATEGORIES,
  GOAL_CATEGORY_TIERS,
  scoreFitness1CategoryForGoal,
} from './portfolio-fitness1-categories.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';

describe('portfolio-fitness1-categories', () => {
  test('всички mapped категории са от реалния каталог', () => {
    const catalog = new Set(FITNESS1_CATALOG_CATEGORIES);
    for (const tiers of Object.values(GOAL_CATEGORY_TIERS)) {
      for (const tier of tiers) {
        for (const name of tier) {
          expect(catalog.has(name)).toBe(true);
        }
      }
    }
  });

  test('excluded категории не се map-ват към цели', () => {
    for (const name of FITNESS1_EXCLUDED_CATEGORIES) {
      for (const goal of PORTFOLIO_GOALS) {
        expect(scoreFitness1CategoryForGoal(name, goal.id)).toBe(-1);
      }
    }
  });

  test('отслабване: Изгаряне на мазнини е tier 1, Протеини са изключени', () => {
    expect(scoreFitness1CategoryForGoal('Изгаряне на мазнини', 'otshalvane')).toBeGreaterThan(
      scoreFitness1CategoryForGoal('Витамини', 'otshalvane')
    );
    expect(scoreFitness1CategoryForGoal('Протеини', 'otshalvane')).toBeNull();
    expect(scoreFitness1CategoryForGoal('Креатин', 'otshalvane')).toBeNull();
  });

  test('muscle: Протеини и Креатин са tier 1', () => {
    expect(scoreFitness1CategoryForGoal('Протеини', 'muscle')).toBe(
      scoreFitness1CategoryForGoal('Креатин', 'muscle')
    );
    expect(scoreFitness1CategoryForGoal('Протеини', 'muscle')).toBeGreaterThan(
      scoreFitness1CategoryForGoal('Витамини', 'muscle')
    );
    expect(scoreFitness1CategoryForGoal('Изгаряне на мазнини', 'muscle')).toBeNull();
  });

  test('antiaging: Anti-Aging е tier 1', () => {
    expect(scoreFitness1CategoryForGoal('Anti-Aging / Против стареене', 'antiaging')).toBeGreaterThan(
      scoreFitness1CategoryForGoal('Антиоксиданти', 'antiaging')
    );
  });

  test('energy: предтрен и стимулатори са tier 1', () => {
    expect(scoreFitness1CategoryForGoal('Предтренировъчни добавки', 'energy')).toBeGreaterThan(
      scoreFitness1CategoryForGoal('Витамини', 'energy')
    );
    expect(scoreFitness1CategoryForGoal('Хардкор продукти и стимулатори', 'energy')).toBeGreaterThan(0);
  });

  test('recovery: стави и качване на маса са tier 1', () => {
    expect(scoreFitness1CategoryForGoal('Стави и сухожилия', 'recovery')).toBeGreaterThan(
      scoreFitness1CategoryForGoal('Креатин', 'recovery')
    );
    expect(scoreFitness1CategoryForGoal('Предтренировъчни добавки', 'recovery')).toBeNull();
  });
});
