import { jest } from '@jest/globals';
import { buildPortfolioAdvisorNarration } from './portfolio-advisor-narration.js';
import { PORTFOLIO_SINGLE_TIER_META } from './portfolio-advisor-engine.js';
import { composeSingleProductOptions } from './portfolio-advisor-compose.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';
import { assembleProtocolFromComposition } from './protocol-stack-composer.js';

function makeProduct(id, name, price) {
  const group = {
    group_id: String(id),
    name,
    brand: 'Brand',
    brand_id: '1',
    category: 'Test',
    category_path: ['Test'],
    image: '',
    variants: [{ sku_id: String(id), retail_price: price, available: true }],
  };
  return portfolioGroupToSiteProduct(group);
}

describe('buildPortfolioAdvisorNarration', () => {
  test('single mode дава независими tier съвети за всеки продукт', () => {
    const ranked = [
      { product: makeProduct(1, 'Premium Whey', 55), score: 10 },
      { product: makeProduct(2, 'Creatine', 12), score: 8 },
      { product: makeProduct(3, 'Multivitamin', 18), score: 6 },
    ];
    const composed = composeSingleProductOptions(ranked, PORTFOLIO_SINGLE_TIER_META);
    const productMap = new Map(ranked.map((r) => [r.product.product_id, r.product]));
    const profile = { selection_mode: 'single', priority: 'muscle' };

    const narration = buildPortfolioAdvisorNarration(composed, profile, productMap);
    const { response } = assembleProtocolFromComposition(composed, narration, productMap, []);

    expect(narration.tier_schedules?.basic).toBeDefined();
    expect(narration.tier_schedules?.optimal).toBeDefined();
    expect(narration.tier_copy.basic.strategy).toMatch(/Premium Whey|Creatine|Multivitamin|Budget/i);
    expect(response.tiers.basic.benefits.some((b) => b.includes('Самостоятелен'))).toBe(true);
    expect(response.tiers.basic.schedule?.morning?.length
      || response.tiers.basic.schedule?.evening?.length).toBeTruthy();
  });
});
