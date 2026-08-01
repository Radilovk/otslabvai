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
        otshalvane: ['Изгаряне на мазнини', 'Витамини и минерали'],
        muscle: ['Протеини', 'Витамини и минерали'],
        health: ['Витамини и минерали', 'Протеини'],
        antiaging: ['Антиейджинг', 'Протеини'],
        energy: ['Енергия и фокус', 'Възстановяване и сън'],
        recovery: ['Възстановяване и сън', 'Протеини'],
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
      portfolio: { category_top: 'Витамини и минерали', category_path: ['Витамини и минерали'] },
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
      portfolio: { category_top: 'Възстановяване и сън' },
    });
    expect(scoreProductForGoal(sleep, 'recovery')).toBeGreaterThan(scoreProductForGoal(sleep, 'energy'));
  });
});
