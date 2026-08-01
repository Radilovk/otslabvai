import {
  scoreCategoryForGoal,
  scoreProductForGoal,
} from './portfolio-goal-relevance.js';
import { PORTFOLIO_GOALS } from './portfolio-goals.js';

function makeProduct(overrides = {}) {
  const portfolio = {
    category_top: '',
    category_path: [],
    category: '',
    ...(overrides.portfolio || {}),
  };
  return {
    public_data: {
      name: 'Test Product',
      tagline: '',
      description: '',
      ...(overrides.public_data || {}),
    },
    system_data: {
      goals: overrides.goals || [],
      portfolio,
      ...(overrides.system_data || {}),
    },
  };
}

describe('portfolio-goal-relevance', () => {
  for (const goal of PORTFOLIO_GOALS) {
    test(`${goal.id}: top-tier category outranks supporting category`, () => {
      const samples = {
        otshalvane: ['Изгаряне на мазнини', 'Витамини'],
        muscle: ['Протеини', 'Витамини'],
        health: ['Витамини', 'Здраве и тонус'],
        antiaging: ['Anti-Aging / Против стареене', 'Витамини'],
        energy: ['Предтренировъчни добавки', 'Витамини'],
        recovery: ['Стави и сухожилия', 'Креатин'],
      };
      const [top, low] = samples[goal.id] || ['Категория А', 'Категория Б'];
      expect(scoreCategoryForGoal(top, goal.id)).toBeGreaterThan(scoreCategoryForGoal(low, goal.id));
    });
  }

  test('fat burner product ranks above multivitamin for weight loss', () => {
    const burner = makeProduct({
      public_data: { name: 'Thermo Fat Burner MAX' },
      portfolio: { category_top: 'Изгаряне на мазнини', category_path: ['Изгаряне на мазнини'] },
    });
    const vitamin = makeProduct({
      public_data: { name: 'Multivitamin Complex' },
      portfolio: { category_top: 'Мултивитамини', category_path: ['Мултивитамини'] },
    });
    expect(scoreProductForGoal(burner, 'otshalvane')).toBeGreaterThan(scoreProductForGoal(vitamin, 'otshalvane'));
  });

  test('whey protein ranks above fat burner for muscle goal', () => {
    const protein = makeProduct({
      public_data: { name: 'Gold Whey Isolate' },
      portfolio: { category_top: 'Протеини', category_path: ['Протеини', 'Whey'] },
    });
    const burner = makeProduct({
      public_data: { name: 'Thermo Burn' },
      portfolio: { category_top: 'Изгаряне на мазнини' },
    });
    expect(scoreProductForGoal(protein, 'muscle')).toBeGreaterThan(0);
    expect(scoreProductForGoal(burner, 'muscle')).toBe(-1);
    expect(scoreProductForGoal(protein, 'muscle')).toBeGreaterThan(scoreProductForGoal(
      makeProduct({ public_data: { name: 'Vitamin C' }, portfolio: { category_top: 'Витамини' } }),
      'muscle'
    ));
  });

  test('melatonin ranks for recovery, not energy', () => {
    const sleep = makeProduct({
      public_data: { name: 'Melatonin 3mg' },
      portfolio: { category_top: 'Билки', category_path: ['Билки'] },
    });
    expect(scoreProductForGoal(sleep, 'recovery')).toBeGreaterThan(scoreProductForGoal(sleep, 'energy'));
  });

  test('аксесоарите са изключени за всички цели', () => {
    for (const goal of PORTFOLIO_GOALS) {
      expect(scoreCategoryForGoal('Спортни аксесоари и уреди', goal.id)).toBe(-1);
      expect(scoreCategoryForGoal('Тениски и облекло', goal.id)).toBe(-1);
    }
  });
});
