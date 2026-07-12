import { inferProductGoals, buildGoalFacetCounts, PORTFOLIO_GOALS } from './portfolio-goals.js';

describe('portfolio-goals', () => {
  test('infers weight-loss goal from category keywords', () => {
    const goals = inferProductGoals({
      group_id: '1',
      name: 'Thermo Fat Burner',
      category: 'Отслабване > Thermo',
      category_top: 'Отслабване',
      search_text: 'thermo fat burn'
    });
    expect(goals).toContain('otshalvane');
  });

  test('infers muscle goal for whey protein', () => {
    const goals = inferProductGoals({
      group_id: '2',
      name: 'Gold Whey',
      category: 'Протеини > Whey',
      category_top: 'Протеини',
      search_text: 'whey protein optimum'
    });
    expect(goals).toContain('muscle');
  });

  test('uses override goals from settings when present', () => {
    const goals = inferProductGoals(
      { group_id: '42', name: 'Generic', category: 'Други', search_text: 'test' },
      { product_overrides: { 42: { goals: ['antiaging'] } } }
    );
    expect(goals).toEqual(['antiaging']);
  });

  test('buildGoalFacetCounts returns labeled facets', () => {
    const facets = buildGoalFacetCounts([
      { goals: ['muscle', 'health'] },
      { goals: ['muscle'] }
    ]);
    expect(facets.find((f) => f.id === 'muscle')?.count).toBe(2);
    expect(PORTFOLIO_GOALS.length).toBeGreaterThan(3);
  });
});
