import {
  summarizeAdvisorCommercialStats,
  attachAdvisorCommercialStats,
  filterAdvisorCommercialProducts,
  isExcludedByAdvisorCommerce,
  scoreAdvisorCommercialBoost,
} from './portfolio-advisor-commerce.js';
import { portfolioGroupToSiteProduct } from './portfolio-import.js';

function makeGroup(overrides = {}) {
  return {
    group_id: '100',
    name: 'Test Product',
    brand: 'Brand',
    brand_id: '1',
    category: 'Протеини',
    distributor: 'sila',
    variants: [{
      sku_id: '1',
      b2b_price: 60,
      regular_price: 100,
      retail_price: 80,
      sale_price: 0,
      available: true,
      is_on_promo: false,
      pricing_mode: 'above_b2b',
    }],
    ...overrides,
  };
}

describe('portfolio-advisor-commerce', () => {
  test('summarizeAdvisorCommercialStats computes distributor discount and margin', () => {
    const stats = summarizeAdvisorCommercialStats(makeGroup());
    expect(stats.distributor_discount_pct).toBe(40);
    expect(stats.margin_eur).toBe(20);
    expect(stats.has_end_user_promo).toBe(false);
    expect(stats.distributor).toBe('sila');
  });

  test('flags end-user promo when sale_price is set', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 60,
        regular_price: 100,
        retail_price: 75,
        sale_price: 80,
        available: true,
        is_on_promo: true,
        pricing_mode: 'f1_promo',
      }],
    });
    const stats = summarizeAdvisorCommercialStats(group);
    expect(stats.has_end_user_promo).toBe(true);
    expect(isExcludedByAdvisorCommerce({ system_data: { portfolio: { commerce: stats } } })).toBe(true);
  });

  test('excludes low distributor discount products', () => {
    const group = makeGroup({
      variants: [{
        sku_id: '1',
        b2b_price: 85,
        regular_price: 100,
        retail_price: 95,
        sale_price: 0,
        available: true,
      }],
    });
    const product = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(group), group);
    expect(isExcludedByAdvisorCommerce(product)).toBe(true);
    expect(filterAdvisorCommercialProducts([product])).toHaveLength(0);
  });

  test('scoreAdvisorCommercialBoost prefers higher margin', () => {
    const high = attachAdvisorCommercialStats(portfolioGroupToSiteProduct(makeGroup()), makeGroup());
    const low = attachAdvisorCommercialStats(
      portfolioGroupToSiteProduct(makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 80,
          regular_price: 100,
          retail_price: 90,
          sale_price: 0,
          available: true,
        }],
      })),
      makeGroup({
        variants: [{
          sku_id: '2',
          b2b_price: 80,
          regular_price: 100,
          retail_price: 90,
          sale_price: 0,
          available: true,
        }],
      })
    );
    expect(scoreAdvisorCommercialBoost(high)).toBeGreaterThan(scoreAdvisorCommercialBoost(low));
  });
});
