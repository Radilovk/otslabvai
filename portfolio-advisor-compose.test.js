import { jest } from '@jest/globals';
import {
  composeSingleProductOptions,
  composePortfolioAdvisorStacks,
} from './portfolio-advisor-compose.js';
import { PORTFOLIO_SINGLE_TIER_META } from './portfolio-advisor-engine.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

function makeRanked(id, name, price) {
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
  return { product: portfolioGroupToSiteProduct(group), score: price };
}

describe('composeSingleProductOptions', () => {
  test('връща 3 различни продукта на различни ценови нива', () => {
    const ranked = [
      makeRanked(1, 'Premium Whey', 55),
      makeRanked(2, 'Creatine', 12),
      makeRanked(3, 'Multivitamin', 18),
      makeRanked(4, 'Budget Protein', 9),
    ];

    const composed = composeSingleProductOptions(ranked, PORTFOLIO_SINGLE_TIER_META);
    const ids = ['basic', 'optimal', 'premium'].map((k) => composed.tiers[k].products[0].product_id);

    expect(new Set(ids).size).toBe(3);
    expect(composed.meta.distinct_products).toBe(3);
    expect(ids[1]).toBe(ranked[0].product.product_id);
  });
});

describe('composePortfolioAdvisorStacks', () => {
  test('single mode използва composeSingleProductOptions', () => {
    const ranked = [
      makeRanked(1, 'A', 40),
      makeRanked(2, 'B', 15),
      makeRanked(3, 'C', 25),
    ];
    const composed = composePortfolioAdvisorStacks(
      { selection_mode: 'single' },
      ranked,
      { tierMeta: PORTFOLIO_SINGLE_TIER_META }
    );
    expect(composed.meta.mode).toBe('single');
    expect(composed.meta.distinct_products).toBe(3);
  });
});
